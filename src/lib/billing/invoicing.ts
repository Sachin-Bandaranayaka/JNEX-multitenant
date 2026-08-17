// src/lib/billing/invoicing.ts
//
// Period close, invoice issue and settlement.
//
// Invoices snapshot their totals at issue time and never recompute from the
// ledger afterwards. Money that has to come back to a tenant after their
// invoice was issued arrives as a negative adjustment on the next one, so an
// invoice a tenant has already seen never silently changes underneath them.

import { ChargeStatus, InvoicePaymentStatus, Prisma, TenantInvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { periodBounds, periodKeyFor, previousPeriodKey } from './period';

const ZERO = new Prisma.Decimal(0);

/** Days after period end that an invoice falls due. */
export const DEFAULT_PAYMENT_TERM_DAYS = Number(process.env.BILLING_PAYMENT_TERM_DAYS ?? 7);

export interface CloseOptions {
  tenantId: string;
  periodKey: string;
  /** Close a period that has not ended yet (used by the "preview / close early" action). */
  allowOpenPeriod?: boolean;
  paymentTermDays?: number;
}

export type CloseResult =
  | { issued: true; invoiceId: string; total: string; chargeCount: number }
  | { issued: false; reason: 'period-not-over' | 'already-invoiced' | 'nothing-to-bill' };

/**
 * Closes one tenant's billing month and issues an invoice for it.
 *
 * Safe to run repeatedly: the unique (tenantId, periodKey) invoice and the
 * ACCRUED → INVOICED status move together mean a second run finds nothing left
 * to bill.
 */
export async function closeBillingPeriod(options: CloseOptions): Promise<CloseResult> {
  const { start, end } = periodBounds(options.periodKey);

  if (!options.allowOpenPeriod && end.getTime() > Date.now()) {
    return { issued: false, reason: 'period-not-over' };
  }

  const termDays = options.paymentTermDays ?? DEFAULT_PAYMENT_TERM_DAYS;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.tenantInvoice.findUnique({
      where: { tenantId_periodKey: { tenantId: options.tenantId, periodKey: options.periodKey } },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== TenantInvoiceStatus.DRAFT) {
      return { issued: false as const, reason: 'already-invoiced' as const };
    }

    const charges = await tx.deliveryCharge.findMany({
      where: {
        tenantId: options.tenantId,
        periodKey: options.periodKey,
        status: ChargeStatus.ACCRUED,
      },
      select: { id: true, amount: true, currency: true },
      orderBy: { periodSequence: 'asc' },
    });

    // Charges reversed after they were already invoiced owe the tenant money
    // back. They are credited here, oldest first.
    const outstandingCredits = await tx.deliveryCharge.findMany({
      where: {
        tenantId: options.tenantId,
        status: ChargeStatus.REVERSED,
        invoiceId: { not: null },
        creditInvoiceId: null,
      },
      select: { id: true, amount: true },
      orderBy: { reversedAt: 'asc' },
    });

    if (charges.length === 0 && outstandingCredits.length === 0) {
      return { issued: false as const, reason: 'nothing-to-bill' as const };
    }

    const subtotal = charges.reduce((sum, charge) => sum.add(charge.amount), ZERO);

    // Credits are applied only as far as the subtotal allows; anything left
    // over stays outstanding and lands on a later invoice. This keeps invoice
    // totals non-negative, which is what the bank-transfer settlement flow can
    // actually represent.
    let creditsApplied = ZERO;
    const appliedCreditIds: string[] = [];
    for (const credit of outstandingCredits) {
      if (creditsApplied.add(credit.amount).gt(subtotal)) continue;
      creditsApplied = creditsApplied.add(credit.amount);
      appliedCreditIds.push(credit.id);
    }

    const total = subtotal.sub(creditsApplied);
    const currency = charges[0]?.currency ?? 'LKR';
    const issuedAt = new Date();
    const dueAt = new Date(end.getTime() + termDays * 24 * 60 * 60 * 1000);

    const invoice = existing
      ? await tx.tenantInvoice.update({
          where: { id: existing.id },
          data: {
            status: TenantInvoiceStatus.ISSUED,
            chargeCount: charges.length,
            subtotal,
            adjustments: creditsApplied.negated(),
            total,
            currency,
            issuedAt,
            dueAt,
          },
        })
      : await tx.tenantInvoice.create({
          data: {
            tenantId: options.tenantId,
            periodKey: options.periodKey,
            periodStart: start,
            periodEnd: end,
            status: TenantInvoiceStatus.ISSUED,
            chargeCount: charges.length,
            subtotal,
            adjustments: creditsApplied.negated(),
            total,
            currency,
            issuedAt,
            dueAt,
          },
        });

    if (charges.length > 0) {
      await tx.deliveryCharge.updateMany({
        where: { id: { in: charges.map((charge) => charge.id) } },
        data: { status: ChargeStatus.INVOICED, invoiceId: invoice.id },
      });
    }
    if (appliedCreditIds.length > 0) {
      await tx.deliveryCharge.updateMany({
        where: { id: { in: appliedCreditIds } },
        data: { creditInvoiceId: invoice.id },
      });
    }

    return {
      issued: true as const,
      invoiceId: invoice.id,
      total: total.toFixed(2),
      chargeCount: charges.length,
    };
  }, { timeout: 30000 });
}

/** Closes the just-ended month for every active tenant. Used by the billing cron. */
export async function closePreviousPeriodForAllTenants(now: Date = new Date()) {
  const periodKey = previousPeriodKey(periodKeyFor(now));
  const tenants = await prisma.tenant.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const results = [];
  for (const tenant of tenants) {
    try {
      const result = await closeBillingPeriod({ tenantId: tenant.id, periodKey });
      results.push({ tenantId: tenant.id, tenantName: tenant.name, ...result });
    } catch (error) {
      results.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        issued: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { periodKey, tenantCount: tenants.length, results };
}

/** Marks an invoice settled and moves its charges to PAID. */
export async function confirmInvoicePayment(paymentId: string, reviewerId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.tenantInvoicePayment.findUnique({
      where: { id: paymentId },
      include: { invoice: { select: { id: true, status: true } } },
    });
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== InvoicePaymentStatus.PENDING) {
      throw new Error(`This payment was already ${payment.status.toLowerCase()}`);
    }

    const paidAt = new Date();

    await tx.tenantInvoicePayment.update({
      where: { id: payment.id },
      data: { status: InvoicePaymentStatus.CONFIRMED, reviewedAt: paidAt, reviewedBy: reviewerId },
    });

    if (payment.invoice.status !== TenantInvoiceStatus.VOID) {
      await tx.tenantInvoice.update({
        where: { id: payment.invoiceId },
        data: { status: TenantInvoiceStatus.PAID, paidAt },
      });
      await tx.deliveryCharge.updateMany({
        where: { invoiceId: payment.invoiceId, status: ChargeStatus.INVOICED },
        data: { status: ChargeStatus.PAID },
      });
    }

    return { invoiceId: payment.invoiceId };
  });
}

export async function rejectInvoicePayment(paymentId: string, reviewerId: string, reason: string) {
  const payment = await prisma.tenantInvoicePayment.findUnique({
    where: { id: paymentId },
    select: { status: true },
  });
  if (!payment) throw new Error('Payment not found');
  if (payment.status !== InvoicePaymentStatus.PENDING) {
    throw new Error(`This payment was already ${payment.status.toLowerCase()}`);
  }

  await prisma.tenantInvoicePayment.update({
    where: { id: paymentId },
    data: {
      status: InvoicePaymentStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
      rejectionReason: reason,
    },
  });
}

/** Forgives a single accrued charge — the escape hatch for goodwill and mistakes. */
export async function waiveCharge(chargeId: string, reason: string) {
  const charge = await prisma.deliveryCharge.findUnique({
    where: { id: chargeId },
    select: { status: true },
  });
  if (!charge) throw new Error('Charge not found');
  if (charge.status !== ChargeStatus.ACCRUED) {
    throw new Error('Only charges that have not been invoiced yet can be waived.');
  }

  await prisma.deliveryCharge.update({
    where: { id: chargeId },
    data: { status: ChargeStatus.WAIVED, waivedReason: reason },
  });
}

export interface BillingSummary {
  periodKey: string;
  currency: string;
  accruedCount: number;
  accruedTotal: string;
  reversedCount: number;
  outstandingInvoiceCount: number;
  outstandingInvoiceTotal: string;
}

/** What a tenant owes right now: this month so far, plus any unpaid invoices. */
export async function getTenantBillingSummary(
  tenantId: string,
  now: Date = new Date(),
): Promise<BillingSummary> {
  const periodKey = periodKeyFor(now);

  const [accrued, reversed, unpaid, anyCharge] = await Promise.all([
    prisma.deliveryCharge.aggregate({
      where: { tenantId, periodKey, status: ChargeStatus.ACCRUED },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.deliveryCharge.count({
      where: { tenantId, periodKey, status: ChargeStatus.REVERSED },
    }),
    prisma.tenantInvoice.aggregate({
      where: { tenantId, status: TenantInvoiceStatus.ISSUED },
      _sum: { total: true },
      _count: true,
    }),
    prisma.deliveryCharge.findFirst({
      where: { tenantId },
      select: { currency: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    periodKey,
    currency: anyCharge?.currency ?? 'LKR',
    accruedCount: accrued._count,
    accruedTotal: (accrued._sum.amount ?? ZERO).toFixed(2),
    reversedCount: reversed,
    outstandingInvoiceCount: unpaid._count,
    outstandingInvoiceTotal: (unpaid._sum.total ?? ZERO).toFixed(2),
  };
}

/** Invoice reference shown to tenants, e.g. "INV-2026-08-0042". */
export function invoiceReference(invoice: { periodKey: string; number: number }): string {
  return `INV-${invoice.periodKey}-${String(invoice.number).padStart(4, '0')}`;
}
