// src/lib/billing/credits.ts
//
// The prepaid credit wallet.
//
// The whole point of this file is one guarantee: a PREPAID tenant can never be
// in the platform's debt for more than a single order's fee. It gets there the
// way a card terminal does — credit is HELD when a shipment leaves and CAPTURED
// when it delivers, so the exposure exists only for the window between the two,
// and only for orders that were already paid for.
//
// Everything takes a Prisma transaction client so a hold rides in the same
// transaction as the status change that caused it. A shipment that was recorded
// without its hold, or a hold without its shipment, is not a state this code
// can produce.

import {
  BillingMode,
  ChargeStatus,
  CreditTxType,
  Prisma,
  type CreditTransaction,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computeFee } from './compute-fee';
import { resolveRate, toRateInput } from './charges';
import { periodKeyFor } from './period';
import {
  creditsDecimal,
  creditsToMoney,
  feeToCredits,
  moneyDecimal,
  resolveCreditPrice,
  roundCredits,
} from './credit-price';

type Tx = Prisma.TransactionClient;

const ZERO = new Prisma.Decimal(0);

/**
 * Thrown when a prepaid tenant tries to ship without the credit to cover it.
 *
 * This is the one billing error that is allowed to abort an operation. Every
 * other billing failure in this codebase stays out of the way of the thing the
 * user was actually doing.
 */
export class InsufficientCreditError extends Error {
  readonly status = 402;
  readonly available: number;
  readonly required: number;
  readonly floor: number;

  constructor(details: { available: number; required: number; floor: number }) {
    const shortfall = roundCredits(details.required - (details.available - details.floor));
    super(
      `Not enough credit to ship. This shipment needs ${details.required} credit(s) and ` +
        `${details.available} are available — top up at least ${Math.max(shortfall, 0)} more.`,
    );
    this.name = 'InsufficientCreditError';
    this.available = details.available;
    this.required = details.required;
    this.floor = details.floor;
  }

  get shortfall() {
    return Math.max(roundCredits(this.required - (this.available - this.floor)), 0);
  }
}

// ---------------------------------------------------------------------------
// Reading the wallet
// ---------------------------------------------------------------------------

/**
 * The tenant's available credit balance.
 *
 * Read from the newest row's running snapshot rather than summing the ledger,
 * because this is on the shipping hot path. The snapshot is only ever written
 * under the tenant's advisory lock, and `reconcileBalance` re-derives it from
 * the ledger to prove the two never drift.
 */
export async function getCreditBalance(tx: Tx, tenantId: string): Promise<number> {
  const latest = await tx.creditTransaction.findFirst({
    where: { tenantId },
    orderBy: { seq: 'desc' },
    select: { creditsAfter: true },
  });
  return latest ? Number(latest.creditsAfter) : 0;
}

/**
 * Credit currently reserved against shipments that have not settled yet.
 *
 * Every hold is eventually cancelled by a release of the same size, so the
 * outstanding total is just the negated sum of the two types. No per-order
 * bookkeeping is needed to work it out.
 */
export async function getHeldCredits(tx: Tx, tenantId: string): Promise<number> {
  const rows = await tx.creditTransaction.groupBy({
    by: ['type'],
    where: { tenantId, type: { in: [CreditTxType.HOLD, CreditTxType.RELEASE] } },
    _sum: { credits: true },
  });
  const total = rows.reduce((sum, row) => sum + Number(row._sum.credits ?? 0), 0);
  return roundCredits(-total);
}

export interface WalletSummary {
  billingMode: BillingMode;
  available: number;
  held: number;
  /** The balance the tenant may not ship below. Usually 0. */
  floor: number;
  /** How much can still be spent before shipping stops. */
  spendable: number;
  unitPrice: number | null;
  currency: string;
  /** Roughly how many more orders can ship, if a fee is configured. */
  shipmentsRemaining: number | null;
}

/** Everything the tenant and super admin credit panels need, in one round trip. */
export async function getWalletSummary(tenantId: string, at: Date = new Date()): Promise<WalletSummary> {
  const [tenant, available, held, price, rate] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { billingMode: true, creditLimitCredits: true, minimumShipCredits: true },
    }),
    getCreditBalance(prisma, tenantId),
    getHeldCredits(prisma, tenantId),
    resolveCreditPrice(prisma, tenantId, at),
    resolveRate(prisma, tenantId, at),
  ]);

  const floor = shipFloor(tenant);
  let shipmentsRemaining: number | null = null;
  if (price && rate) {
    const perOrder = feeToCredits(
      computeFee({ rate: toRateInput(rate), orderTotal: 0, periodSequence: 1 }),
      Number(price.unitPrice),
    );
    // Percentage pricing has no fixed per-order cost, so no honest estimate
    // exists — better to show nothing than a number that is wrong per order.
    if (perOrder > 0) shipmentsRemaining = Math.floor((available - floor) / perOrder);
  }

  return {
    billingMode: tenant.billingMode,
    available,
    held,
    floor,
    spendable: roundCredits(available - floor),
    unitPrice: price ? Number(price.unitPrice) : null,
    currency: price?.currency ?? 'LKR',
    shipmentsRemaining,
  };
}

/**
 * The balance a tenant may not ship below.
 *
 * `minimumShipCredits` is the explicit setting. When it is not set the floor is
 * the negated overdraft allowance, so `creditLimitCredits` of 5000 means "you
 * may go 5000 credits into the red" — which is how a long-standing postpaid
 * tenant is moved across without hitting a wall on their first day.
 */
export function shipFloor(tenant: {
  minimumShipCredits: Prisma.Decimal | null;
  creditLimitCredits: Prisma.Decimal;
}): number {
  if (tenant.minimumShipCredits != null) return Number(tenant.minimumShipCredits);
  const limit = Number(tenant.creditLimitCredits);
  // Negating a zero allowance yields -0, which compares fine but renders as
  // "-0" everywhere it is shown.
  return limit === 0 ? 0 : -limit;
}

// ---------------------------------------------------------------------------
// Writing the ledger
// ---------------------------------------------------------------------------

export interface PostInput {
  tenantId: string;
  type: CreditTxType;
  /** Signed, in credits. Negative spends, positive funds. */
  credits: number;
  unitPrice: number;
  currency?: string;
  creditPriceId?: string | null;
  /** Must be globally unique and derived from the event, never random. */
  idempotencyKey: string;
  orderId?: string | null;
  chargeId?: string | null;
  topUpId?: string | null;
  reason?: string | null;
  createdByUserId?: string | null;
}

export type PostResult = {
  transaction: CreditTransaction;
  balance: number;
  /** false when the key had already been posted and nothing new happened. */
  posted: boolean;
};

/**
 * The only writer of the ledger.
 *
 * Serialises per tenant, replays safely on the same key, and stamps the running
 * balance so reads stay cheap. Nothing else in the codebase should create a
 * CreditTransaction directly.
 */
export async function postCreditTx(tx: Tx, input: PostInput): Promise<PostResult> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'credit-ledger:' + input.tenantId}))`;

  const existing = await tx.creditTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) {
    return { transaction: existing, balance: Number(existing.creditsAfter), posted: false };
  }

  const credits = roundCredits(input.credits);
  const current = await getCreditBalance(tx, input.tenantId);
  const balance = roundCredits(current + credits);

  const transaction = await tx.creditTransaction.create({
    data: {
      tenantId: input.tenantId,
      type: input.type,
      credits: creditsDecimal(credits),
      creditsAfter: creditsDecimal(balance),
      amount: moneyDecimal(creditsToMoney(credits, input.unitPrice)),
      unitPrice: moneyDecimal(input.unitPrice),
      currency: input.currency || 'LKR',
      creditPriceId: input.creditPriceId || null,
      idempotencyKey: input.idempotencyKey,
      orderId: input.orderId || null,
      chargeId: input.chargeId || null,
      topUpId: input.topUpId || null,
      reason: input.reason || null,
      createdByUserId: input.createdByUserId || null,
    },
  });

  return { transaction, balance, posted: true };
}

// ---------------------------------------------------------------------------
// Pricing a shipment
// ---------------------------------------------------------------------------

export type QuoteResult =
  | { billable: true; credits: number; fee: number; unitPrice: number; currency: string; creditPriceId: string }
  | { billable: false; reason: 'postpaid' | 'no-rate' | 'no-credit-price' };

/**
 * What one shipment will cost the wallet.
 *
 * Two of the three "not billable" answers are deliberate states rather than
 * faults. `no-rate` means the tenant has not been priced yet, exactly as in
 * `accrueDeliveryCharge`. `no-credit-price` means a fee exists but cannot be
 * expressed in credits — a misconfiguration that only a super admin can create,
 * and one where refusing to ship would punish the tenant for it. Both let the
 * shipment through unbilled and are surfaced on the super admin console instead.
 */
export async function quoteShipment(
  tx: Tx,
  input: { tenantId: string; orderTotal: number; at: Date; billingMode?: BillingMode },
): Promise<QuoteResult> {
  const billingMode =
    input.billingMode ??
    (await tx.tenant.findUniqueOrThrow({ where: { id: input.tenantId }, select: { billingMode: true } }))
      .billingMode;

  if (billingMode !== BillingMode.PREPAID) return { billable: false, reason: 'postpaid' };

  const rate = await resolveRate(tx, input.tenantId, input.at);
  if (!rate) return { billable: false, reason: 'no-rate' };

  const price = await resolveCreditPrice(tx, input.tenantId, input.at);
  if (!price) return { billable: false, reason: 'no-credit-price' };

  // Volume tiers are priced on the delivered-order count, which is not known
  // until delivery. The hold uses the count so far as its estimate; the capture
  // at delivery re-prices against the real sequence, so any difference between
  // the two is settled then rather than being carried.
  const periodSequence =
    (await tx.deliveryCharge.count({
      where: { tenantId: input.tenantId, periodKey: periodKeyFor(input.at) },
    })) + 1;

  const fee = computeFee({ rate: toRateInput(rate), orderTotal: input.orderTotal, periodSequence });
  const unitPrice = Number(price.unitPrice);

  return {
    billable: true,
    credits: feeToCredits(fee, unitPrice),
    fee,
    unitPrice,
    currency: price.currency,
    creditPriceId: price.id,
  };
}

export interface ShipCheck {
  ok: boolean;
  billingMode: BillingMode;
  available: number;
  required: number;
  floor: number;
  shortfall: number;
  reason: string | null;
}

/**
 * Whether a shipment may proceed, without writing anything.
 *
 * Used for the pre-flight check in the shipping routes so a waybill is never
 * bought from a courier for a shipment the wallet is about to refuse. The
 * binding check is still the hold itself.
 */
export async function checkCanShip(
  tx: Tx,
  input: { tenantId: string; orderTotal: number; at?: Date },
): Promise<ShipCheck> {
  const at = input.at ?? new Date();
  const tenant = await tx.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { billingMode: true, creditLimitCredits: true, minimumShipCredits: true },
  });

  const base = {
    billingMode: tenant.billingMode,
    floor: shipFloor(tenant),
    available: 0,
    required: 0,
    shortfall: 0,
  };

  if (tenant.billingMode !== BillingMode.PREPAID) {
    return { ...base, ok: true, reason: null };
  }

  const quote = await quoteShipment(tx, {
    tenantId: input.tenantId,
    orderTotal: input.orderTotal,
    at,
    billingMode: tenant.billingMode,
  });
  const available = await getCreditBalance(tx, input.tenantId);

  if (!quote.billable) {
    return { ...base, available, ok: true, reason: null };
  }

  const ok = roundCredits(available - quote.credits) >= base.floor;
  return {
    ...base,
    available,
    required: quote.credits,
    ok,
    shortfall: ok ? 0 : Math.max(roundCredits(quote.credits - (available - base.floor)), 0),
    reason: ok ? null : 'insufficient-credit',
  };
}

// ---------------------------------------------------------------------------
// Lifecycle hooks — called from transitionOrder, inside its transaction
// ---------------------------------------------------------------------------

export type HoldResult =
  | { held: true; credits: number; balance: number }
  | { held: false; reason: 'postpaid' | 'no-rate' | 'no-credit-price' | 'already-held' };

/**
 * Reserves the fee for a shipment that is leaving.
 *
 * Throws `InsufficientCreditError` when the tenant cannot cover it, which rolls
 * back the enclosing status change — the order stays unshipped. This is the
 * mechanism that makes the whole scheme safe, so it deliberately does not have
 * a "log it and carry on" path.
 */
export async function holdForShipment(
  tx: Tx,
  input: {
    tenantId: string;
    orderId: string;
    orderTotal: number;
    at: Date;
    billingMode?: BillingMode;
    /**
     * Records the hold without enforcing the floor. Used when the shipment is
     * already a fact rather than a request — a courier reporting a parcel in
     * transit is not asking permission, and refusing it would leave the order
     * stuck in the wrong state while the parcel moves. The tenant goes negative
     * and the super admin console shows it.
     */
    allowOverdraft?: boolean;
  },
): Promise<HoldResult> {
  const quote = await quoteShipment(tx, input);
  if (!quote.billable) return { held: false, reason: quote.reason };
  if (quote.credits <= 0) return { held: false, reason: 'no-rate' };

  const existing = await tx.creditTransaction.findUnique({
    where: { idempotencyKey: `hold:${input.orderId}` },
    select: { id: true },
  });
  if (existing) return { held: false, reason: 'already-held' };

  const tenant = await tx.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { creditLimitCredits: true, minimumShipCredits: true },
  });
  const floor = shipFloor(tenant);
  const available = await getCreditBalance(tx, input.tenantId);

  if (!input.allowOverdraft && roundCredits(available - quote.credits) < floor) {
    throw new InsufficientCreditError({ available, required: quote.credits, floor });
  }

  const posted = await postCreditTx(tx, {
    tenantId: input.tenantId,
    type: CreditTxType.HOLD,
    credits: -quote.credits,
    unitPrice: quote.unitPrice,
    currency: quote.currency,
    creditPriceId: quote.creditPriceId,
    idempotencyKey: `hold:${input.orderId}`,
    orderId: input.orderId,
    reason: input.allowOverdraft ? 'Reserved on courier-reported shipment' : 'Reserved on shipment',
  });

  return { held: true, credits: quote.credits, balance: posted.balance };
}

/**
 * Gives a hold back — the shipment was returned or cancelled before delivering.
 *
 * Idempotent on the order, and a no-op when there was never a hold, so it is
 * safe to call on every non-delivery exit from SHIPPED.
 */
export async function releaseHold(
  tx: Tx,
  input: { orderId: string; reason: string },
): Promise<{ released: boolean; credits: number }> {
  const hold = await tx.creditTransaction.findUnique({
    where: { idempotencyKey: `hold:${input.orderId}` },
  });
  if (!hold) return { released: false, credits: 0 };

  const credits = Math.abs(Number(hold.credits));
  const posted = await postCreditTx(tx, {
    tenantId: hold.tenantId,
    type: CreditTxType.RELEASE,
    credits,
    unitPrice: Number(hold.unitPrice),
    currency: hold.currency,
    creditPriceId: hold.creditPriceId,
    idempotencyKey: `release:${input.orderId}`,
    orderId: input.orderId,
    reason: input.reason,
  });

  return { released: posted.posted, credits };
}

export type CaptureResult =
  | { captured: true; credits: number; balance: number }
  | { captured: false; reason: 'postpaid' | 'no-credit-price' | 'no-charge' | 'already-captured' };

/**
 * Turns a hold into a real spend when an order delivers.
 *
 * The hold was an estimate taken at ship time; the charge is the truth. So the
 * hold is released in full and the actual fee captured separately — the two
 * rows make the difference between estimate and truth visible in the ledger
 * instead of hiding it inside a net adjustment.
 *
 * The balance is allowed to go negative here. A courier telling us an order
 * delivered is not a request we get to decline, and refusing to record a
 * delivery over a billing shortfall would corrupt the order history to protect
 * a number that a super admin can simply chase.
 */
export async function captureForDelivery(
  tx: Tx,
  input: { tenantId: string; orderId: string; at: Date; billingMode?: BillingMode },
): Promise<CaptureResult> {
  const billingMode =
    input.billingMode ??
    (await tx.tenant.findUniqueOrThrow({ where: { id: input.tenantId }, select: { billingMode: true } }))
      .billingMode;
  if (billingMode !== BillingMode.PREPAID) {
    // A tenant moved back to invoicing mid-flight still has holds against
    // orders that shipped while they were prepaid. Returning early without
    // releasing them would strand that credit until the maintenance sweep
    // noticed, so the release happens here whatever mode they are in now.
    await releaseHold(tx, { orderId: input.orderId, reason: 'Hold released — tenant is now invoiced monthly' });
    return { captured: false, reason: 'postpaid' };
  }

  const charge = await tx.deliveryCharge.findUnique({ where: { orderId: input.orderId } });
  if (!charge) {
    // No rate in force, so nothing was owed. Any hold still needs returning.
    await releaseHold(tx, { orderId: input.orderId, reason: 'Delivered with no fee rate in force' });
    return { captured: false, reason: 'no-charge' };
  }

  await releaseHold(tx, { orderId: input.orderId, reason: 'Hold settled on delivery' });

  const price =
    (await resolveCreditPrice(tx, input.tenantId, input.at)) ??
    (await resolveCreditPrice(tx, input.tenantId, charge.deliveredAt));
  if (!price) return { captured: false, reason: 'no-credit-price' };

  const unitPrice = Number(price.unitPrice);
  const credits = feeToCredits(Number(charge.amount), unitPrice);

  const posted = await postCreditTx(tx, {
    tenantId: input.tenantId,
    type: CreditTxType.CAPTURE,
    credits: -credits,
    unitPrice,
    currency: price.currency,
    creditPriceId: price.id,
    idempotencyKey: `capture:${input.orderId}`,
    orderId: input.orderId,
    chargeId: charge.id,
    reason: 'Delivery fee',
  });
  if (!posted.posted) return { captured: false, reason: 'already-captured' };

  // The fee is settled the moment it is captured, so it must never also appear
  // on an invoice. Leaving it ACCRUED would let `closeBillingPeriod` bill a
  // prepaid tenant a second time for money already taken from their wallet.
  await tx.deliveryCharge.update({
    where: { id: charge.id },
    data: { status: ChargeStatus.PAID },
  });

  return { captured: true, credits, balance: posted.balance };
}

/**
 * Returns a captured fee to the wallet when a delivered order is later returned.
 *
 * The refund is the credit quantity that was actually taken, not a re-derived
 * one: if the credit price moved in between, the tenant gets back the shipping
 * power they lost, which is the only version of this that is fair in both
 * directions.
 */
export async function refundCapture(
  tx: Tx,
  input: { orderId: string; reason: string },
): Promise<{ refunded: boolean; credits: number }> {
  const capture = await tx.creditTransaction.findUnique({
    where: { idempotencyKey: `capture:${input.orderId}` },
  });
  if (!capture) return { refunded: false, credits: 0 };

  const credits = Math.abs(Number(capture.credits));
  const posted = await postCreditTx(tx, {
    tenantId: capture.tenantId,
    type: CreditTxType.REFUND,
    credits,
    unitPrice: Number(capture.unitPrice),
    currency: capture.currency,
    creditPriceId: capture.creditPriceId,
    idempotencyKey: `refund:${input.orderId}`,
    orderId: input.orderId,
    chargeId: capture.chargeId,
    reason: input.reason,
  });

  return { refunded: posted.posted, credits };
}

// ---------------------------------------------------------------------------
// Super admin operations
// ---------------------------------------------------------------------------

/** A manual correction. Always carries a reason and an actor — no silent money. */
export async function adjustCredits(input: {
  tenantId: string;
  credits: number;
  reason: string;
  createdByUserId: string;
  idempotencyKey?: string;
}) {
  if (!Number.isFinite(input.credits) || input.credits === 0) {
    throw new Error('An adjustment must be a non-zero number of credits.');
  }
  if (!input.reason.trim()) {
    throw new Error('A reason is required so the ledger stays auditable.');
  }

  return prisma.$transaction(async (tx) => {
    const price = await resolveCreditPrice(tx, input.tenantId, new Date());
    return postCreditTx(tx, {
      tenantId: input.tenantId,
      type: CreditTxType.ADJUSTMENT,
      credits: input.credits,
      unitPrice: price ? Number(price.unitPrice) : 0,
      currency: price?.currency ?? 'LKR',
      creditPriceId: price?.id ?? null,
      idempotencyKey: input.idempotencyKey ?? `adjust:${crypto.randomUUID()}`,
      reason: input.reason.trim(),
      createdByUserId: input.createdByUserId,
    });
  });
}

/**
 * Re-derives the balance from the whole ledger and compares it to the running
 * snapshot. The snapshot exists only to keep reads cheap; if the two ever
 * disagree, the sum is right and the snapshot is the bug.
 */
export async function reconcileBalance(tenantId: string) {
  const [aggregate, snapshot] = await Promise.all([
    prisma.creditTransaction.aggregate({ where: { tenantId }, _sum: { credits: true } }),
    prisma.creditTransaction.findFirst({
      where: { tenantId },
      orderBy: { seq: 'desc' },
      select: { creditsAfter: true, seq: true },
    }),
  ]);

  const derived = Number(aggregate._sum.credits ?? ZERO);
  const stored = snapshot ? Number(snapshot.creditsAfter) : 0;
  const drift = roundCredits(derived - stored);

  return { tenantId, derived, stored, drift, inSync: drift === 0, lastSeq: snapshot?.seq ?? null };
}

// ---------------------------------------------------------------------------
// Pre-flight for the shipping routes
// ---------------------------------------------------------------------------

export interface BulkShipmentPlan {
  billingMode: BillingMode;
  available: number;
  floor: number;
  /** Order ids that fit within the balance, in the order they were offered. */
  allowed: string[];
  blocked: Array<{ orderId: string; required: number; reason: string }>;
}

/**
 * Works out how much of a bulk shipment the wallet can actually fund.
 *
 * Budgets across the batch rather than checking each order against the full
 * balance, because ten orders that each pass individually can still overdraw
 * the tenant together. Partially funding a batch beats failing all of it: the
 * tenant gets the shipments they paid for and a clear list of what did not go.
 */
export async function planBulkShipment(
  tenantId: string,
  orders: Array<{ orderId: string; orderTotal: number }>,
  at: Date = new Date(),
): Promise<BulkShipmentPlan> {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { billingMode: true, creditLimitCredits: true, minimumShipCredits: true },
  });
  const floor = shipFloor(tenant);

  if (tenant.billingMode !== BillingMode.PREPAID) {
    return {
      billingMode: tenant.billingMode,
      available: 0,
      floor,
      allowed: orders.map((order) => order.orderId),
      blocked: [],
    };
  }

  const available = await getCreditBalance(prisma, tenantId);
  let budget = available;

  const allowed: string[] = [];
  const blocked: BulkShipmentPlan['blocked'] = [];

  for (const order of orders) {
    const quote = await quoteShipment(prisma, {
      tenantId,
      orderTotal: order.orderTotal,
      at,
      billingMode: tenant.billingMode,
    });
    // Not billable means nothing to reserve, so nothing to refuse.
    if (!quote.billable) {
      allowed.push(order.orderId);
      continue;
    }
    if (roundCredits(budget - quote.credits) < floor) {
      blocked.push({
        orderId: order.orderId,
        required: quote.credits,
        reason: 'Not enough credit remaining in this batch.',
      });
      continue;
    }
    budget = roundCredits(budget - quote.credits);
    allowed.push(order.orderId);
  }

  return { billingMode: tenant.billingMode, available, floor, allowed, blocked };
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export interface MaintenanceReport {
  checked: number;
  notified: Array<{ tenantId: string; name: string; balance: number }>;
  staleHoldsReleased: Array<{ tenantId: string; orderId: string; credits: number }>;
  drifted: Array<{ tenantId: string; derived: number; stored: number; drift: number }>;
}

/**
 * The daily sweep for prepaid tenants.
 *
 * Three jobs, all of them things that would otherwise be noticed late: warn a
 * tenant before they run dry, return holds that outlived the order they were
 * placed for, and prove the running balances still agree with the ledger.
 */
export async function runCreditMaintenance(now: Date = new Date()): Promise<MaintenanceReport> {
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true, billingMode: BillingMode.PREPAID },
    select: {
      id: true,
      name: true,
      businessName: true,
      lowBalanceCredits: true,
      lowBalanceNotifiedAt: true,
      minimumShipCredits: true,
      creditLimitCredits: true,
    },
  });

  const report: MaintenanceReport = {
    checked: tenants.length,
    notified: [],
    staleHoldsReleased: [],
    drifted: [],
  };

  for (const tenant of tenants) {
    const balance = await getCreditBalance(prisma, tenant.id);

    // Warned once per dip, re-armed when the wallet is funded again, so a
    // tenant sitting just under the line is not messaged every single day.
    const threshold = tenant.lowBalanceCredits == null ? null : Number(tenant.lowBalanceCredits);
    if (threshold != null && balance <= threshold && tenant.lowBalanceNotifiedAt == null) {
      await prisma.$transaction([
        prisma.notification.create({
          data: {
            tenantId: tenant.id,
            title: 'Shipping credit is running low',
            description: `${balance.toLocaleString('en-LK')} credits left. Top up to keep shipping without interruption.`,
            type: 'SYSTEM',
          },
        }),
        prisma.tenant.update({ where: { id: tenant.id }, data: { lowBalanceNotifiedAt: now } }),
      ]);
      report.notified.push({ tenantId: tenant.id, name: tenant.name.trim() || tenant.businessName || 'Unnamed tenant', balance });
    }

    // A hold belongs to an order that is on its way. If the order left SHIPPED
    // without the release landing — an interrupted deploy, a manual database
    // fix — the credit is stranded, and the tenant is the one paying for it.
    const holds = await prisma.creditTransaction.findMany({
      where: { tenantId: tenant.id, type: CreditTxType.HOLD },
      select: { orderId: true, credits: true },
    });
    for (const hold of holds) {
      if (!hold.orderId) continue;
      const settled = await prisma.creditTransaction.findFirst({
        where: { idempotencyKey: { in: [`release:${hold.orderId}`, `capture:${hold.orderId}`] } },
        select: { id: true },
      });
      if (settled) continue;

      const order = await prisma.order.findUnique({
        where: { id: hold.orderId },
        select: { status: true },
      });
      if (!order || order.status === 'SHIPPED' || order.status === 'RESCHEDULED') continue;

      await prisma.$transaction((tx) =>
        releaseHold(tx, { orderId: hold.orderId as string, reason: 'Stale hold returned by maintenance' }),
      );
      report.staleHoldsReleased.push({
        tenantId: tenant.id,
        orderId: hold.orderId,
        credits: Math.abs(Number(hold.credits)),
      });
    }

    const check = await reconcileBalance(tenant.id);
    if (!check.inSync) {
      report.drifted.push({
        tenantId: tenant.id,
        derived: check.derived,
        stored: check.stored,
        drift: check.drift,
      });
    }
  }

  return report;
}
