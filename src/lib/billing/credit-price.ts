// src/lib/billing/credit-price.ts
//
// What one credit costs, and how a money fee turns into credits.
//
// Prices are effective-dated and never updated in place, for the same reason
// fee rates are not: a tenant who prepaid 100 credits at LKR 75 must keep 100
// credits' worth of shipping when the price moves to LKR 90. Re-valuing a
// wallet that someone already paid for is a refund conversation, not a config
// change, so the model simply makes it impossible.
//
// Resolution is two-level: a row scoped to the tenant wins, otherwise the
// platform-wide row (tenantId = null) applies.

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

type Tx = Prisma.TransactionClient;

/** Credits carry 4 decimal places; percentage-of-order fees need the room. */
export const CREDIT_DP = 4;

/** Round half-up to 4 decimal places. */
export function roundCredits(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Cannot round a non-finite credit amount');
  return Math.round((value + Number.EPSILON) * 1e4) / 1e4;
}

export function creditsDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(roundCredits(value).toFixed(CREDIT_DP));
}

export function moneyDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

/**
 * How many credits a money fee consumes at a given credit price.
 *
 * With the common setup — a LKR 75 flat fee and a LKR 75 credit — this is
 * exactly 1.0000 credit per delivered order, which is what makes "100 credits
 * = 100 shipments" true for tenants without hard-coding it anywhere.
 */
export function feeToCredits(fee: number, unitPrice: number): number {
  if (!(unitPrice > 0)) {
    throw new Error('A credit price must be greater than zero.');
  }
  return roundCredits(Math.max(0, fee || 0) / unitPrice);
}

/** The money value of a credit quantity, for reporting and top-up quoting. */
export function creditsToMoney(credits: number, unitPrice: number): number {
  return Math.round((credits * unitPrice + Number.EPSILON) * 100) / 100;
}

export interface CreditPriceInput {
  /** null sets the platform-wide default. */
  tenantId?: string | null;
  unitPrice: number;
  currency?: string;
  minimumPurchaseCredits?: number;
  effectiveFrom?: Date;
  note?: string | null;
  createdByUserId?: string | null;
}

export function validateCreditPrice(input: CreditPriceInput): string[] {
  const problems: string[] = [];
  if (!Number.isFinite(input.unitPrice)) problems.push('A credit price is required.');
  else if (input.unitPrice <= 0) problems.push('A credit must cost more than zero.');
  if (input.minimumPurchaseCredits != null) {
    if (!Number.isFinite(input.minimumPurchaseCredits) || input.minimumPurchaseCredits <= 0) {
      problems.push('The minimum purchase must be a positive number of credits.');
    }
  }
  return problems;
}

/**
 * The price in force for a tenant at an instant, or null if none is.
 *
 * A tenant-scoped row always beats the platform default, even if the platform
 * default is newer — that is what "override" means.
 */
export async function resolveCreditPrice(tx: Tx, tenantId: string, at: Date) {
  const inForce: Prisma.CreditPriceWhereInput = {
    effectiveFrom: { lte: at },
    OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
  };

  const scoped = await tx.creditPrice.findFirst({
    where: { tenantId, ...inForce },
    orderBy: { effectiveFrom: 'desc' },
  });
  if (scoped) return scoped;

  return tx.creditPrice.findFirst({
    where: { tenantId: null, ...inForce },
    orderBy: { effectiveFrom: 'desc' },
  });
}

/** Convenience wrapper for read paths that are not already in a transaction. */
export function currentCreditPrice(tenantId: string, at: Date = new Date()) {
  return resolveCreditPrice(prisma, tenantId, at);
}

/** The platform-wide default price in force, ignoring tenant overrides. */
export function platformCreditPrice(at: Date = new Date()) {
  return prisma.creditPrice.findFirst({
    where: {
      tenantId: null,
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}

/**
 * Puts a new credit price in force, closing whatever was in force for the same
 * scope. Mirrors `supersedeRate` deliberately: same locking, same "you cannot
 * back-date over the open row" rule, same never-destructive shape.
 */
export async function supersedeCreditPrice(input: CreditPriceInput) {
  const problems = validateCreditPrice(input);
  if (problems.length > 0) throw new Error(problems.join(' '));

  const tenantId = input.tenantId ?? null;
  const effectiveFrom = input.effectiveFrom ?? new Date();
  const scope = tenantId ?? 'platform';

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'credit-price:' + scope}))`;

    const open = await tx.creditPrice.findFirst({
      where: { tenantId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (open && open.effectiveFrom.getTime() >= effectiveFrom.getTime()) {
      throw new Error(
        `The current credit price already starts on ${open.effectiveFrom.toISOString().slice(0, 10)}; a new price must start after that.`,
      );
    }

    if (open) {
      await tx.creditPrice.update({ where: { id: open.id }, data: { effectiveTo: effectiveFrom } });
    }

    return tx.creditPrice.create({
      data: {
        tenantId,
        unitPrice: moneyDecimal(input.unitPrice),
        currency: input.currency || 'LKR',
        minimumPurchaseCredits: creditsDecimal(input.minimumPurchaseCredits ?? 100),
        effectiveFrom,
        note: input.note || null,
        createdByUserId: input.createdByUserId || null,
      },
    });
  });
}

/** Price history for a scope, newest first. */
export function listCreditPrices(tenantId: string | null) {
  return prisma.creditPrice.findMany({
    where: { tenantId },
    orderBy: { effectiveFrom: 'desc' },
  });
}

/** Human-readable one-liner, used across both consoles. */
export function describeCreditPrice(price: {
  unitPrice: Prisma.Decimal;
  currency: string;
  minimumPurchaseCredits: Prisma.Decimal;
}): string {
  const min = Number(price.minimumPurchaseCredits);
  return `${price.currency} ${price.unitPrice.toFixed(2)} per credit · minimum ${min.toLocaleString('en-LK')} credits`;
}

/** Trims trailing zeros so 1.0000 reads as "1" and 1.2500 as "1.25". */
export function formatCredits(credits: Prisma.Decimal | number | string): string {
  const value = Number(credits);
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
}
