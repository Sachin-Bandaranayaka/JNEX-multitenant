// src/app/(authenticated)/billing/page.tsx

export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { BillingMode, ChargeStatus, CreditTxType, TenantInvoiceStatus } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatPeriod, periodKeyFor } from '@/lib/billing/period';
import { describeRate } from '@/lib/billing/rates';
import { invoiceReference } from '@/lib/billing/invoicing';
import { getWalletSummary } from '@/lib/billing/credits';
import { currentCreditPrice, formatCredits } from '@/lib/billing/credit-price';
import { listTopUps, topUpReference } from '@/lib/billing/topups';
import { PayInvoiceForm } from './pay-invoice-form';
import { TopUpForm } from './top-up-form';

/** Ledger types in the tenant's language rather than the enum's. */
const CREDIT_ACTIVITY: Record<CreditTxType, string> = {
  TOPUP: 'Credits purchased',
  HOLD: 'Reserved on shipment',
  RELEASE: 'Reservation returned',
  CAPTURE: 'Delivery fee',
  REFUND: 'Refunded after return',
  ADJUSTMENT: 'Adjustment',
};

function money(amount: string | number, currency = 'LKR') {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return `${currency} ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect('/auth/signin');
  if (session.user.role !== 'ADMIN') redirect('/unauthorized');

  const tenantId = session.user.tenantId;
  const periodKey = periodKeyFor(new Date());

  const [tenant, wallet, creditPrice, topUps, ledger] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { billingMode: true } }),
    getWalletSummary(tenantId),
    currentCreditPrice(tenantId),
    listTopUps(tenantId, 10),
    prisma.creditTransaction.findMany({
      where: { tenantId },
      orderBy: { seq: 'desc' },
      take: 25,
      include: { order: { select: { number: true, customerName: true } } },
    }),
  ]);
  const prepaid = tenant.billingMode === BillingMode.PREPAID;

  const [rate, thisMonth, reversedCount, invoices, recentCharges] = await Promise.all([
    prisma.tenantFeeRate.findFirst({
      where: { tenantId, effectiveTo: null },
      orderBy: { effectiveFrom: 'desc' },
    }),
    prisma.deliveryCharge.aggregate({
      where: { tenantId, periodKey, status: ChargeStatus.ACCRUED },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.deliveryCharge.count({
      where: { tenantId, periodKey, status: ChargeStatus.REVERSED },
    }),
    prisma.tenantInvoice.findMany({
      where: { tenantId, status: { not: TenantInvoiceStatus.DRAFT } },
      orderBy: { periodKey: 'desc' },
      take: 12,
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.deliveryCharge.findMany({
      where: { tenantId, periodKey },
      orderBy: { deliveredAt: 'desc' },
      take: 25,
      include: { order: { select: { number: true, customerName: true } } },
    }),
  ]);

  const currency = rate?.currency ?? recentCharges[0]?.currency ?? 'LKR';
  const outstanding = invoices.filter((invoice) => invoice.status === TenantInvoiceStatus.ISSUED);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {prepaid
            ? 'You ship against prepaid credit. Credit is reserved when an order ships and charged when it delivers — returns give it straight back.'
            : `You are charged per delivered order. ${formatPeriod(periodKey)} is still running and will be invoiced at the start of next month.`}
        </p>
      </div>

      {prepaid && (
        <>
          {wallet.spendable <= 0 && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
              <p className="font-semibold text-red-600 dark:text-red-400">Shipping is paused</p>
              <p className="mt-1 text-sm text-red-600/90 dark:text-red-400/90">
                You have no credit left. Buy credits below to start shipping again — orders already on their
                way are unaffected.
              </p>
            </div>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Shipping credit</h2>
              {creditPrice && (
                <TopUpForm
                  minimumCredits={Number(creditPrice.minimumPurchaseCredits)}
                  unitPrice={Number(creditPrice.unitPrice)}
                  currency={creditPrice.currency}
                />
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="text-sm font-medium text-muted-foreground">Available</div>
                <div
                  className={`mt-2 text-3xl font-semibold tabular-nums ${
                    wallet.spendable <= 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                  }`}
                >
                  {formatCredits(wallet.available)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  credits
                  {wallet.shipmentsRemaining != null &&
                    ` · about ${wallet.shipmentsRemaining.toLocaleString('en-LK')} more order${
                      wallet.shipmentsRemaining === 1 ? '' : 's'
                    }`}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <div className="text-sm font-medium text-muted-foreground">Reserved</div>
                <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {formatCredits(wallet.held)}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  held against orders in transit — returned to you if they do not deliver
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <div className="text-sm font-medium text-muted-foreground">Credit price</div>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {creditPrice
                    ? `${creditPrice.currency} ${Number(creditPrice.unitPrice).toFixed(2)} each`
                    : 'Not set'}
                </div>
                {creditPrice && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    minimum {formatCredits(creditPrice.minimumPurchaseCredits)} credits per purchase
                  </div>
                )}
              </div>
            </div>

            {topUps.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Purchase</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Submitted</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credits</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {topUps.map((topUp) => (
                      <tr key={topUp.id}>
                        <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{topUpReference(topUp)}</td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {topUp.createdAt.toLocaleDateString('en-LK')}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                          {formatCredits(topUp.creditedCredits ?? topUp.credits)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                          {money(topUp.amount.toFixed(2), topUp.currency)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {topUp.status === 'REJECTED' && topUp.rejectionReason
                            ? `Rejected — ${topUp.rejectionReason}`
                            : topUp.status === 'PENDING'
                              ? 'Awaiting review'
                              : 'Credited'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Credit activity</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">When</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">What</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credits</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Nothing yet. Buy credits to start shipping.
                      </td>
                    </tr>
                  )}
                  {ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {entry.createdAt.toLocaleString('en-LK')}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {CREDIT_ACTIVITY[entry.type]}
                        {entry.order && ` · order #${entry.order.number}`}
                      </td>
                      <td
                        className={`px-4 py-3 text-right text-sm tabular-nums ${
                          Number(entry.credits) < 0 ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {Number(entry.credits) > 0 ? '+' : ''}
                        {formatCredits(entry.credits)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-muted-foreground">
                        {formatCredits(entry.creditsAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">{formatPeriod(periodKey)} so far</div>
          <div className="mt-2 text-3xl font-semibold text-foreground tabular-nums">
            {money(Number(thisMonth._sum.amount ?? 0), currency)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {thisMonth._count} delivered order{thisMonth._count === 1 ? '' : 's'}
            {reversedCount > 0 && ` · ${reversedCount} returned and credited`}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">Your rate</div>
          <div className="mt-2 text-lg font-semibold text-foreground">
            {rate ? describeRate(rate) : 'No rate set yet'}
          </div>
          {rate?.note && <div className="mt-1 text-sm text-muted-foreground">{rate.note}</div>}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-medium text-muted-foreground">Awaiting payment</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {money(outstanding.reduce((sum, invoice) => sum + Number(invoice.total), 0), currency)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {outstanding.length} unpaid invoice{outstanding.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {outstanding.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Invoices to pay</h2>
          {outstanding.map((invoice) => {
            const pendingPayment = invoice.payments[0]?.status === 'PENDING' ? invoice.payments[0] : null;
            const rejected = invoice.payments[0]?.status === 'REJECTED' ? invoice.payments[0] : null;
            return (
              <div key={invoice.id} className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-foreground">
                      {invoiceReference(invoice)} · {formatPeriod(invoice.periodKey)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {invoice.chargeCount} delivered orders
                      {Number(invoice.adjustments) !== 0 &&
                        ` · ${money(invoice.adjustments.toFixed(2), invoice.currency)} in credits`}
                      {invoice.dueAt && ` · due ${invoice.dueAt.toLocaleDateString('en-LK')}`}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                      {money(invoice.total.toFixed(2), invoice.currency)}
                    </div>
                    {rejected && (
                      <p className="mt-2 text-sm text-red-500">
                        Your last transfer was rejected: {rejected.rejectionReason}
                      </p>
                    )}
                  </div>
                  {pendingPayment ? (
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                      Transfer submitted — awaiting review
                    </span>
                  ) : (
                    <PayInvoiceForm
                      invoiceId={invoice.id}
                      amountDue={invoice.total.toFixed(2)}
                      currency={invoice.currency}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Invoice history</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Period</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No invoices yet.
                  </td>
                </tr>
              )}
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{invoiceReference(invoice)}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{formatPeriod(invoice.periodKey)}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">{invoice.chargeCount}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                    {money(invoice.total.toFixed(2), invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{invoice.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">This month&apos;s charges</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {recentCharges.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No delivered orders billed this month yet.
                  </td>
                </tr>
              )}
              {recentCharges.map((charge) => (
                <tr key={charge.id}>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {charge.deliveredAt.toLocaleDateString('en-LK')}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    #{charge.order.number} · {charge.order.customerName}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-foreground">
                    {money(charge.amount.toFixed(2), charge.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {charge.status === 'REVERSED' ? 'Credited (returned)' : charge.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
