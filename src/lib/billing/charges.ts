// src/lib/billing/charges.ts
//
// Accrual and reversal of platform fees. Everything here takes a Prisma
// transaction client so it can run inside the very same transaction that moves
// the order to DELIVERED — that is what guarantees you can never end up with a
// delivered order that was never billed, or a bill for an order that never
// delivered.

import { ChargeStatus, FeeModel, Prisma } from '@prisma/client';
import { computeFee, parseTiers, type FeeModelName, type FeeRateInput } from './compute-fee';
import { periodKeyFor } from './period';

type Tx = Prisma.TransactionClient;

/** Turns a stored rate row into the plain input `computeFee` expects. */
export function toRateInput(rate: {
  feeModel: FeeModel;
  flatAmount: Prisma.Decimal | null;
  percentRate: Prisma.Decimal | null;
  tiers: Prisma.JsonValue | null;
  minFee: Prisma.Decimal | null;
  maxFee: Prisma.Decimal | null;
}): FeeRateInput {
  return {
    feeModel: rate.feeModel as FeeModelName,
    flatAmount: rate.flatAmount == null ? null : rate.flatAmount.toNumber(),
    percentRate: rate.percentRate == null ? null : rate.percentRate.toNumber(),
    tiers: rate.tiers == null ? null : parseTiers(rate.tiers),
    minFee: rate.minFee == null ? null : rate.minFee.toNumber(),
    maxFee: rate.maxFee == null ? null : rate.maxFee.toNumber(),
  };
}

/**
 * The rate in force for a tenant at a given instant, or null if none is.
 *
 * "No rate" is a legitimate, deliberate state — it is how a tenant is onboarded
 * before pricing is agreed, and how the cutover works: deliveries before the
 * first rate's `effectiveFrom` simply are not billable.
 */
export async function resolveRate(tx: Tx, tenantId: string, at: Date) {
  return tx.tenantFeeRate.findFirst({
    where: {
      tenantId,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}

export interface AccrueInput {
  tenantId: string;
  orderId: string;
  orderTotal: number;
  deliveredAt: Date;
}

export type AccrualResult =
  | { billed: true; chargeId: string; amount: number; currency: string; periodKey: string }
  | { billed: false; reason: 'already-charged' | 'no-rate' };

/**
 * Records the platform fee for a delivered order.
 *
 * Idempotent: `DeliveryCharge.orderId` is unique, so a retried cron, a
 * re-uploaded courier file, or a manual re-mark all collapse onto the one row.
 * Never throws for billing reasons — a delivery must still be recorded even if
 * the tenant has no rate configured.
 */
export async function accrueDeliveryCharge(tx: Tx, input: AccrueInput): Promise<AccrualResult> {
  const existing = await tx.deliveryCharge.findUnique({
    where: { orderId: input.orderId },
    select: { id: true },
  });
  if (existing) return { billed: false, reason: 'already-charged' };

  const rate = await resolveRate(tx, input.tenantId, input.deliveredAt);
  if (!rate) return { billed: false, reason: 'no-rate' };

  const periodKey = periodKeyFor(input.deliveredAt);

  // PostgreSQL's default isolation level allows two simultaneous deliveries
  // to observe the same prior count. Serialize this tenant/month while the
  // enclosing order transaction computes and inserts the sequence number.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'billing-accrual:' + input.tenantId + ':' + periodKey}))`;

  // Volume tiers are evaluated against the tenant's delivery count for the
  // month. Rows are never deleted, so counting them keeps the sequence stable:
  // a later reversal credits the fee but does not renumber everything after it.
  const priorCount = await tx.deliveryCharge.count({
    where: { tenantId: input.tenantId, periodKey },
  });
  const periodSequence = priorCount + 1;

  const amount = computeFee({
    rate: toRateInput(rate),
    orderTotal: input.orderTotal,
    periodSequence,
  });

  const charge = await tx.deliveryCharge.create({
    data: {
      tenantId: input.tenantId,
      orderId: input.orderId,
      rateId: rate.id,
      feeModel: rate.feeModel,
      orderTotal: new Prisma.Decimal(Math.max(0, input.orderTotal || 0).toFixed(2)),
      amount: new Prisma.Decimal(amount.toFixed(2)),
      currency: rate.currency,
      status: ChargeStatus.ACCRUED,
      deliveredAt: input.deliveredAt,
      periodKey,
      periodSequence,
    },
  });

  return { billed: true, chargeId: charge.id, amount, currency: rate.currency, periodKey };
}

/**
 * Reverses the fee for an order that was returned after being delivered.
 *
 * The ledger is append-only, so nothing is deleted. If the charge had not been
 * invoiced yet it simply stops counting; if it was already invoiced or paid,
 * the row is left pointing at that invoice and the money comes back as a
 * negative adjustment on the tenant's next invoice.
 */
export async function reverseDeliveryCharge(
  tx: Tx,
  input: { orderId: string; reason: string; at?: Date },
): Promise<{ reversed: boolean; creditOwed: boolean }> {
  const charge = await tx.deliveryCharge.findUnique({
    where: { orderId: input.orderId },
    select: { id: true, status: true, invoiceId: true },
  });
  if (!charge) return { reversed: false, creditOwed: false };
  if (charge.status === ChargeStatus.REVERSED || charge.status === ChargeStatus.WAIVED) {
    return { reversed: false, creditOwed: false };
  }

  await tx.deliveryCharge.update({
    where: { id: charge.id },
    data: {
      status: ChargeStatus.REVERSED,
      reversedAt: input.at ?? new Date(),
      reversalReason: input.reason,
    },
  });

  return { reversed: true, creditOwed: charge.invoiceId !== null };
}
