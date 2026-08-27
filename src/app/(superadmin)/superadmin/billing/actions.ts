// src/app/(superadmin)/superadmin/billing/actions.ts

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/superadmin-auth';
import { adjustCredits } from '@/lib/billing/credits';
import { currentCreditPrice, supersedeCreditPrice } from '@/lib/billing/credit-price';
import { confirmTopUp, rejectTopUp } from '@/lib/billing/topups';
import { supersedeRate } from '@/lib/billing/rates';
import {
  closeBillingPeriod,
  confirmInvoicePayment,
  rejectInvoicePayment,
  waiveCharge,
} from '@/lib/billing/invoicing';
import type { FeeTier } from '@/lib/billing/compute-fee';

const optionalNumber = z.preprocess(
  (value) => (value === '' || value == null ? undefined : Number(value)),
  z.number().finite().optional(),
);

const rateSchema = z.object({
  tenantId: z.string().min(1),
  feeModel: z.enum(['FLAT_PER_ORDER', 'PERCENT_OF_ORDER', 'TIERED_BY_VOLUME']),
  flatAmount: optionalNumber,
  /** Entered as a human percentage (2.5), stored as a fraction (0.025). */
  percentDisplay: optionalNumber,
  minFee: optionalNumber,
  maxFee: optionalNumber,
  currency: z.string().min(1).default('LKR'),
  effectiveFrom: z.string().optional(),
  note: z.string().optional(),
  tiers: z.string().optional(),
});

/** Parses the tier rows the form submits as "upTo:amount" lines. */
function parseTierField(raw: string | undefined): FeeTier[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [boundPart, amountPart] = line.split(':').map((part) => part.trim());
      const amount = Number(amountPart);
      if (!Number.isFinite(amount)) {
        throw new Error(`Could not read a fee amount from tier line "${line}".`);
      }
      const isOpenEnded = boundPart === '' || boundPart === '*' || boundPart.toLowerCase() === 'rest';
      if (isOpenEnded) return { upTo: null, amount };
      const upTo = Number(boundPart);
      if (!Number.isFinite(upTo)) {
        throw new Error(`Could not read an order count from tier line "${line}".`);
      }
      return { upTo, amount };
    });
}

export async function setTenantRate(formData: FormData): Promise<void> {
  const { actor: user } = await requireSuperAdmin();

  const parsed = rateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((issue) => issue.message).join(' '));
  }
  const input = parsed.data;

  await supersedeRate({
    tenantId: input.tenantId,
    feeModel: input.feeModel,
    flatAmount: input.feeModel === 'FLAT_PER_ORDER' ? input.flatAmount ?? null : null,
    percentRate: input.feeModel === 'PERCENT_OF_ORDER' && input.percentDisplay != null
      ? input.percentDisplay / 100
      : null,
    tiers: input.feeModel === 'TIERED_BY_VOLUME' ? parseTierField(input.tiers) : null,
    minFee: input.minFee ?? null,
    maxFee: input.maxFee ?? null,
    currency: input.currency,
    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
    note: input.note || null,
    createdByUserId: user.id,
  });

  revalidatePath(`/superadmin/billing/${input.tenantId}`);
  revalidatePath('/superadmin/billing');
}

export async function closePeriodForTenant(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const tenantId = String(formData.get('tenantId') || '');
  const periodKey = String(formData.get('periodKey') || '');
  const allowOpenPeriod = formData.get('allowOpenPeriod') === 'true';
  if (!tenantId || !periodKey) throw new Error('Tenant and period are required.');

  const result = await closeBillingPeriod({ tenantId, periodKey, allowOpenPeriod });
  if (!result.issued && result.reason === 'period-not-over') {
    throw new Error('That billing month has not finished yet. Use "Close early" to issue it anyway.');
  }

  revalidatePath(`/superadmin/billing/${tenantId}`);
  revalidatePath('/superadmin/billing');
}

export async function confirmPayment(formData: FormData): Promise<void> {
  const { actor: user } = await requireSuperAdmin();

  const paymentId = String(formData.get('paymentId') || '');
  if (!paymentId) throw new Error('Payment is required.');

  await confirmInvoicePayment(paymentId, user.id);

  revalidatePath('/superadmin/billing');
}

export async function rejectPayment(formData: FormData): Promise<void> {
  const { actor: user } = await requireSuperAdmin();

  const paymentId = String(formData.get('paymentId') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (!paymentId) throw new Error('Payment is required.');
  if (!reason) throw new Error('Please say why the transfer was rejected — the tenant sees this.');

  await rejectInvoicePayment(paymentId, user.id, reason);

  revalidatePath('/superadmin/billing');
}

export async function waiveChargeAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const chargeId = String(formData.get('chargeId') || '');
  const tenantId = String(formData.get('tenantId') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (!chargeId) throw new Error('Charge is required.');
  if (!reason) throw new Error('A reason is required so the ledger stays auditable.');

  await waiveCharge(chargeId, reason);

  revalidatePath(`/superadmin/billing/${tenantId}`);
}

// ---------------------------------------------------------------------------
// Prepaid credits
// ---------------------------------------------------------------------------

const creditPriceSchema = z.object({
  /** Blank means the platform-wide default rather than one tenant. */
  tenantId: z.string().optional(),
  unitPrice: z.coerce.number().finite(),
  minimumPurchaseCredits: z.coerce.number().finite().optional(),
  currency: z.string().min(1).default('LKR'),
  effectiveFrom: z.string().optional(),
  note: z.string().optional(),
});

export async function setCreditPrice(formData: FormData): Promise<void> {
  const { actor: user } = await requireSuperAdmin();

  const parsed = creditPriceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((issue) => issue.message).join(' '));
  }
  const input = parsed.data;
  const tenantId = input.tenantId?.trim() || null;

  await supersedeCreditPrice({
    tenantId,
    unitPrice: input.unitPrice,
    minimumPurchaseCredits: input.minimumPurchaseCredits ?? 100,
    currency: input.currency,
    effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : undefined,
    note: input.note || null,
    createdByUserId: user.id,
  });

  if (tenantId) revalidatePath(`/superadmin/billing/${tenantId}`);
  revalidatePath('/superadmin/billing');
  revalidatePath('/superadmin/billing/credits');
}

const creditPolicySchema = z.object({
  tenantId: z.string().min(1),
  billingMode: z.enum(['POSTPAID', 'PREPAID']),
  creditLimitCredits: z.coerce.number().finite().min(0).default(0),
  minimumShipCredits: optionalNumber,
  lowBalanceCredits: optionalNumber,
});

/**
 * Moves a tenant between postpaid invoicing and prepaid credit, and sets the
 * thresholds that go with it.
 *
 * Switching to PREPAID is refused unless a credit price resolves for the
 * tenant. Without one there is no way to express a fee in credits, so the
 * tenant would ship unbilled — the failure would be silent, and silent is the
 * worst way for a billing system to be wrong.
 */
export async function setCreditPolicy(formData: FormData): Promise<void> {
  const { actor: user } = await requireSuperAdmin();

  const parsed = creditPolicySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((issue) => issue.message).join(' '));
  }
  const input = parsed.data;

  if (input.billingMode === 'PREPAID') {
    const price = await currentCreditPrice(input.tenantId);
    if (!price) {
      throw new Error(
        'Set a credit price — platform-wide or for this tenant — before switching them to prepaid.',
      );
    }
  }

  const before = await prisma.tenant.findUniqueOrThrow({
    where: { id: input.tenantId },
    select: { billingMode: true, name: true },
  });

  await prisma.tenant.update({
    where: { id: input.tenantId },
    data: {
      billingMode: input.billingMode,
      creditLimitCredits: new Prisma.Decimal(input.creditLimitCredits.toFixed(4)),
      minimumShipCredits:
        input.minimumShipCredits == null ? null : new Prisma.Decimal(input.minimumShipCredits.toFixed(4)),
      lowBalanceCredits:
        input.lowBalanceCredits == null ? null : new Prisma.Decimal(input.lowBalanceCredits.toFixed(4)),
    },
  });

  if (before.billingMode !== input.billingMode) {
    await prisma.auditEvent.create({
      data: {
        actorId: user.id,
        tenantId: input.tenantId,
        action: 'TENANT_BILLING_MODE_CHANGED',
        entityType: 'Tenant',
        entityId: input.tenantId,
        metadata: { tenantName: before.name, from: before.billingMode, to: input.billingMode },
      },
    });
  }

  revalidatePath(`/superadmin/billing/${input.tenantId}`);
  revalidatePath('/superadmin/billing');
}

export async function confirmTopUpAction(formData: FormData): Promise<void> {
  const { actor: user } = await requireSuperAdmin();

  const topUpId = String(formData.get('topUpId') || '');
  if (!topUpId) throw new Error('Top-up is required.');
  const raw = String(formData.get('creditedCredits') || '').trim();
  const creditedCredits = raw === '' ? null : Number(raw);
  if (creditedCredits != null && !Number.isFinite(creditedCredits)) {
    throw new Error('The credited amount must be a number.');
  }

  const result = await confirmTopUp({
    topUpId,
    reviewerId: user.id,
    creditedCredits,
    note: String(formData.get('note') || '').trim() || null,
  });

  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      tenantId: (await prisma.creditTopUp.findUniqueOrThrow({ where: { id: topUpId }, select: { tenantId: true } })).tenantId,
      action: 'CREDIT_TOPUP_CONFIRMED',
      entityType: 'CreditTopUp',
      entityId: topUpId,
      metadata: { credits: result.credits, balance: result.balance },
    },
  });

  revalidatePath('/superadmin/billing');
  revalidatePath('/superadmin/billing/credits');
}

export async function rejectTopUpAction(formData: FormData): Promise<void> {
  const { actor: user } = await requireSuperAdmin();

  const topUpId = String(formData.get('topUpId') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (!topUpId) throw new Error('Top-up is required.');

  const topUp = await rejectTopUp({ topUpId, reviewerId: user.id, reason });

  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      tenantId: topUp.tenantId,
      action: 'CREDIT_TOPUP_REJECTED',
      entityType: 'CreditTopUp',
      entityId: topUpId,
      metadata: { reason },
    },
  });

  revalidatePath('/superadmin/billing');
  revalidatePath('/superadmin/billing/credits');
}

/** Manual wallet correction — goodwill, a bank error, a migration opening balance. */
export async function adjustCreditsAction(formData: FormData): Promise<void> {
  const { actor: user } = await requireSuperAdmin();

  const tenantId = String(formData.get('tenantId') || '');
  const credits = Number(String(formData.get('credits') || ''));
  const reason = String(formData.get('reason') || '').trim();
  if (!tenantId) throw new Error('Tenant is required.');
  if (!Number.isFinite(credits) || credits === 0) {
    throw new Error('Enter a non-zero number of credits — negative to take credit back.');
  }
  if (!reason) throw new Error('A reason is required so the ledger stays auditable.');

  const result = await adjustCredits({ tenantId, credits, reason, createdByUserId: user.id });

  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      tenantId,
      action: 'CREDIT_ADJUSTED',
      entityType: 'Tenant',
      entityId: tenantId,
      metadata: { credits, reason, balance: result.balance },
    },
  });

  revalidatePath(`/superadmin/billing/${tenantId}`);
  revalidatePath('/superadmin/billing');
}
