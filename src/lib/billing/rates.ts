// src/lib/billing/rates.ts
//
// Rate changes are versioned, never destructive. Superseding a rate closes the
// current row and opens a new one, so every historic DeliveryCharge still
// points at the exact terms that produced it.

import { FeeModel, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { validateRate, type FeeModelName, type FeeTier } from './compute-fee';

export interface NewRateInput {
  tenantId: string;
  feeModel: FeeModelName;
  flatAmount?: number | null;
  percentRate?: number | null;
  tiers?: FeeTier[] | null;
  minFee?: number | null;
  maxFee?: number | null;
  currency?: string;
  /** When the new terms take effect. Defaults to now. */
  effectiveFrom?: Date;
  note?: string | null;
  createdByUserId?: string | null;
}

function decimalOrNull(value: number | null | undefined, places = 2): Prisma.Decimal | null {
  return value == null ? null : new Prisma.Decimal(value.toFixed(places));
}

/**
 * Puts a new rate in force for a tenant, closing whatever was in force before.
 *
 * Validation happens here rather than at accrual time on purpose: a broken rate
 * discovered by the delivery cron would block deliveries, so it must be
 * impossible to save one.
 */
export async function supersedeRate(input: NewRateInput) {
  const problems = validateRate(input);
  if (problems.length > 0) {
    throw new Error(problems.join(' '));
  }

  const effectiveFrom = input.effectiveFrom ?? new Date();

  return prisma.$transaction(async (tx) => {
    const open = await tx.tenantFeeRate.findFirst({
      where: { tenantId: input.tenantId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (open && open.effectiveFrom.getTime() >= effectiveFrom.getTime()) {
      throw new Error(
        `The current rate already starts on ${open.effectiveFrom.toISOString().slice(0, 10)}; a new rate must start after that.`,
      );
    }

    if (open) {
      await tx.tenantFeeRate.update({
        where: { id: open.id },
        data: { effectiveTo: effectiveFrom },
      });
    }

    return tx.tenantFeeRate.create({
      data: {
        tenantId: input.tenantId,
        feeModel: input.feeModel as FeeModel,
        flatAmount: decimalOrNull(input.flatAmount),
        percentRate: decimalOrNull(input.percentRate, 6),
        tiers: input.tiers ? (input.tiers as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        minFee: decimalOrNull(input.minFee),
        maxFee: decimalOrNull(input.maxFee),
        currency: input.currency || 'LKR',
        effectiveFrom,
        note: input.note || null,
        createdByUserId: input.createdByUserId || null,
      },
    });
  });
}

/** Full rate history for a tenant, newest first. */
export async function listRates(tenantId: string) {
  return prisma.tenantFeeRate.findMany({
    where: { tenantId },
    orderBy: { effectiveFrom: 'desc' },
    include: { _count: { select: { charges: true } } },
  });
}

/** The rate in force right now, or null if the tenant is not billable yet. */
export async function currentRate(tenantId: string) {
  const now = new Date();
  return prisma.tenantFeeRate.findFirst({
    where: {
      tenantId,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}

/** Human-readable one-liner for a rate row, used across both UIs. */
export function describeRate(rate: {
  feeModel: FeeModel;
  flatAmount: Prisma.Decimal | null;
  percentRate: Prisma.Decimal | null;
  tiers: Prisma.JsonValue | null;
  currency: string;
}): string {
  switch (rate.feeModel) {
    case 'FLAT_PER_ORDER':
      return `${rate.currency} ${rate.flatAmount?.toFixed(2) ?? '—'} per delivered order`;
    case 'PERCENT_OF_ORDER':
      return `${((rate.percentRate?.toNumber() ?? 0) * 100).toFixed(2)}% of each delivered order`;
    case 'TIERED_BY_VOLUME': {
      const tiers = Array.isArray(rate.tiers) ? rate.tiers.length : 0;
      return `${tiers} volume tier${tiers === 1 ? '' : 's'} per month`;
    }
    default:
      return 'Unknown fee model';
  }
}
