// src/app/(superadmin)/superadmin/billing/actions.ts

'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/superadmin-auth';
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
