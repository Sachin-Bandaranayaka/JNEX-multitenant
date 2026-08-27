// src/lib/billing/topups.ts
//
// Buying credit. Mirrors the store purchase and invoice payment flows: the
// tenant submits bank transfer details, a super admin verifies the money
// actually arrived, and only then does credit reach the wallet.
//
// The tenant chooses a quantity of credits, not an amount of money. That keeps
// the quantity exact (no dividing a transferred amount and rounding), makes the
// minimum purchase easy to express, and means the tenant is told up front what
// their shipping capacity will be rather than having to work it out.

import { CreditTxType, TopUpStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { postCreditTx } from './credits';
import {
  creditsDecimal,
  creditsToMoney,
  moneyDecimal,
  resolveCreditPrice,
  roundCredits,
} from './credit-price';

export interface QuoteInput {
  tenantId: string;
  credits: number;
  at?: Date;
}

export type TopUpQuote =
  | {
      ok: true;
      credits: number;
      unitPrice: number;
      amount: number;
      currency: string;
      creditPriceId: string;
      minimumCredits: number;
    }
  | { ok: false; reason: 'no-credit-price' | 'below-minimum' | 'invalid'; message: string; minimumCredits?: number };

/** Prices a proposed purchase at the credit price in force right now. */
export async function quoteTopUp(input: QuoteInput): Promise<TopUpQuote> {
  const credits = roundCredits(input.credits);
  if (!Number.isFinite(credits) || credits <= 0) {
    return { ok: false, reason: 'invalid', message: 'Enter how many credits you want to buy.' };
  }

  const price = await resolveCreditPrice(prisma, input.tenantId, input.at ?? new Date());
  if (!price) {
    return {
      ok: false,
      reason: 'no-credit-price',
      message: 'Credit pricing has not been set up yet. Please contact support.',
    };
  }

  const minimumCredits = Number(price.minimumPurchaseCredits);
  if (credits < minimumCredits) {
    return {
      ok: false,
      reason: 'below-minimum',
      minimumCredits,
      message: `The smallest top-up is ${minimumCredits.toLocaleString('en-LK')} credits.`,
    };
  }

  const unitPrice = Number(price.unitPrice);
  return {
    ok: true,
    credits,
    unitPrice,
    amount: creditsToMoney(credits, unitPrice),
    currency: price.currency,
    creditPriceId: price.id,
    minimumCredits,
  };
}

export interface SubmitInput {
  tenantId: string;
  submittedByUserId: string;
  credits: number;
  bankReceiptNumber: string;
  whatsappNumber: string;
  transferTime: Date;
}

/**
 * Records a claimed bank transfer. Creates nothing in the wallet — an
 * unverified claim is worth exactly zero credits until someone confirms it.
 */
export async function submitTopUp(input: SubmitInput) {
  const quote = await quoteTopUp({ tenantId: input.tenantId, credits: input.credits });
  if (!quote.ok) throw new Error(quote.message);

  return prisma.creditTopUp.create({
    data: {
      tenantId: input.tenantId,
      submittedByUserId: input.submittedByUserId,
      credits: creditsDecimal(quote.credits),
      unitPrice: moneyDecimal(quote.unitPrice),
      amount: moneyDecimal(quote.amount),
      currency: quote.currency,
      creditPriceId: quote.creditPriceId,
      bankReceiptNumber: input.bankReceiptNumber,
      whatsappNumber: input.whatsappNumber,
      transferTime: input.transferTime,
    },
  });
}

/**
 * Confirms a transfer and funds the wallet.
 *
 * `creditedCredits` lets a super admin honour a short or over transfer for what
 * actually arrived instead of rejecting it and making the tenant start again.
 * The purchase is claimed with a conditional update inside the transaction, so
 * two admins clicking confirm at the same moment cannot fund the wallet twice.
 */
export async function confirmTopUp(input: {
  topUpId: string;
  reviewerId: string;
  creditedCredits?: number | null;
  note?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const topUp = await tx.creditTopUp.findUnique({ where: { id: input.topUpId } });
    if (!topUp) throw new Error('Top-up not found');
    if (topUp.status !== TopUpStatus.PENDING) {
      throw new Error(`This top-up was already ${topUp.status.toLowerCase()}.`);
    }

    const credits =
      input.creditedCredits != null ? roundCredits(input.creditedCredits) : Number(topUp.credits);
    if (!(credits > 0)) throw new Error('The credited amount must be greater than zero.');

    const claimed = await tx.creditTopUp.updateMany({
      where: { id: topUp.id, status: TopUpStatus.PENDING },
      data: {
        status: TopUpStatus.CONFIRMED,
        creditedCredits: creditsDecimal(credits),
        reviewedAt: new Date(),
        reviewedBy: input.reviewerId,
        reviewNote: input.note || null,
      },
    });
    if (claimed.count !== 1) throw new Error('This top-up was already processed.');

    const posted = await postCreditTx(tx, {
      tenantId: topUp.tenantId,
      type: CreditTxType.TOPUP,
      credits,
      unitPrice: Number(topUp.unitPrice),
      currency: topUp.currency,
      creditPriceId: topUp.creditPriceId,
      // Keyed on the purchase, so a retry of this whole operation credits once.
      idempotencyKey: `topup:${topUp.id}`,
      topUpId: topUp.id,
      reason: `Bank transfer ${topUp.bankReceiptNumber}`,
      createdByUserId: input.reviewerId,
    });

    // Clearing the flag re-arms the low-balance nudge for next time.
    await tx.tenant.update({
      where: { id: topUp.tenantId },
      data: { lowBalanceNotifiedAt: null },
    });

    await tx.notification.create({
      data: {
        tenantId: topUp.tenantId,
        title: 'Credits added',
        description: `${credits.toLocaleString('en-LK')} credits are now available. Balance: ${posted.balance.toLocaleString('en-LK')}.`,
        type: 'SYSTEM',
      },
    });

    return { topUpId: topUp.id, credits, balance: posted.balance };
  });
}

export async function rejectTopUp(input: { topUpId: string; reviewerId: string; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new Error('Please say why the transfer was rejected — the tenant sees this.');

  const rejected = await prisma.creditTopUp.updateMany({
    where: { id: input.topUpId, status: TopUpStatus.PENDING },
    data: {
      status: TopUpStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: input.reviewerId,
      rejectionReason: reason,
    },
  });
  if (rejected.count !== 1) throw new Error('This top-up was already processed.');

  const topUp = await prisma.creditTopUp.findUniqueOrThrow({ where: { id: input.topUpId } });
  await prisma.notification.create({
    data: {
      tenantId: topUp.tenantId,
      title: 'Top-up rejected',
      description: reason,
      type: 'SYSTEM',
    },
  });

  return topUp;
}

/** Reference shown to tenants, e.g. "TOP-0042". */
export function topUpReference(topUp: { number: number }): string {
  return `TOP-${String(topUp.number).padStart(4, '0')}`;
}

/** Purchase history for a tenant, newest first. */
export function listTopUps(tenantId: string, take = 20) {
  return prisma.creditTopUp.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take,
    include: { submittedBy: { select: { name: true, email: true } } },
  });
}

/** Everything awaiting a super admin decision, oldest first. */
export function pendingTopUps() {
  return prisma.creditTopUp.findMany({
    where: { status: TopUpStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    include: {
      tenant: { select: { id: true, name: true, businessName: true } },
      submittedBy: { select: { name: true, email: true } },
    },
  });
}
