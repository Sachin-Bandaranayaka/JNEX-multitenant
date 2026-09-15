// src/app/(authenticated)/billing/page.tsx

export const dynamic = 'force-dynamic';

import Link from 'next/link';
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

type BillingFilters = { status?: string; activity?: string; from?: string; to?: string; invoicePage?: string; creditPage?: string };

function localDay(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const day = new Date(`${value}T00:00:00+05:30`);
  if (!Number.isFinite(day.getTime()) || new Date(day.getTime() + 19800000).toISOString().slice(0, 10) !== value) return undefined;
  return day;
}

function pageNumber(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100000) : 1;
}

function historyLink(filters: BillingFilters, key: 'invoicePage' | 'creditPage', page: number) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) if (value) params.set(name, value);
  params.set(key, String(page));
  return `/billing?${params.toString()}#${key === 'invoicePage' ? 'invoice-history' : 'credit-history'}`;
}

function HistoryFilters({ filters, prepaid }: { filters: BillingFilters; prepaid: boolean }) {
  const field = 'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
  return <form action="/billing" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
    <label className="text-sm font-medium">Invoice status<select name="status" defaultValue={filters.status ?? ''} className={field}>
      <option value="">All statuses</option><option value="ISSUED">Awaiting payment</option><option value="PAID">Paid</option><option value="VOID">Voided</option>
    </select></label>
    {prepaid && <label className="text-sm font-medium">Credit activity<select name="activity" defaultValue={filters.activity ?? ''} className={field}>
      <option value="">All activity</option>{Object.entries(CREDIT_ACTIVITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>}
    <label className="text-sm font-medium">From date<input type="date" name="from" defaultValue={filters.from} className={field} /></label>
    <label className="text-sm font-medium">To date<input type="date" name="to" defaultValue={filters.to} className={field} /></label>
    <div className="flex items-end gap-3"><button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Apply</button><Link href="/billing" className="py-2 text-sm underline underline-offset-4">Clear</Link></div>
    <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-5">Dates use Sri Lanka time. Filters apply to history; balances and invoices to pay always include all outstanding amounts.</p>
  </form>;
}

export default async function BillingPage({ searchParams: query }: { searchParams: Promise<BillingFilters> }) {
  const searchParams = await query;
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect('/auth/signin');
  if (session.user.role !== 'ADMIN') redirect('/unauthorized');

  const tenantId = session.user.tenantId;
  const periodKey = periodKeyFor(new Date());

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { billingMode: true } });
  const prepaid = tenant.billingMode === BillingMode.PREPAID;
  const from = localDay(searchParams.from);
  const to = localDay(searchParams.to);
  const createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86400000) } : {}) };
  const invoicePage = pageNumber(searchParams.invoicePage);
  const creditPage = pageNumber(searchParams.creditPage);
  const invoiceStatus = [TenantInvoiceStatus.ISSUED, TenantInvoiceStatus.PAID, TenantInvoiceStatus.VOID].find((status) => status === searchParams.status);
  const activity = Object.values(CreditTxType).find((type) => type === searchParams.activity);
  const [wallet, creditPrice, topUps, ledgerRows] = await Promise.all([
    prepaid ? getWalletSummary(tenantId).catch(() => null) : null,
    prepaid ? currentCreditPrice(tenantId) : null,
    prepaid ? listTopUps(tenantId, 10) : [],
    prepaid ? prisma.creditTransaction.findMany({
      where: { tenantId, createdAt, ...(activity ? { type: activity } : {}) },
      orderBy: { seq: 'desc' }, skip: (creditPage - 1) * 25, take: 26,
      include: { order: { select: { number: true, customerName: true } } },
    }) : [],
  ]);
  const ledger = ledgerRows.slice(0, 25);

  const [rate, thisMonth, reversedCount, invoiceRows, recentCharges, outstanding] = await Promise.all([
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
      where: { tenantId, createdAt, status: invoiceStatus ?? { not: TenantInvoiceStatus.DRAFT } },
      orderBy: [{ periodKey: 'desc' }, { id: 'desc' }],
      skip: (invoicePage - 1) * 12, take: 13,
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.deliveryCharge.findMany({
      where: { tenantId, periodKey },
      orderBy: { deliveredAt: 'desc' },
      take: 25,
      include: { order: { select: { number: true, customerName: true } } },
    }),
    prisma.tenantInvoice.findMany({
      where: { tenantId, status: TenantInvoiceStatus.ISSUED },
      orderBy: { periodKey: 'asc' },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
  ]);

  const invoices = invoiceRows.slice(0, 12);
  const currency = rate?.currency ?? recentCharges[0]?.currency ?? 'LKR';
  const outstandingTotals = outstanding.reduce<Record<string, number>>((totals, invoice) => {
    totals[invoice.currency] = (totals[invoice.currency] ?? 0) + Number(invoice.total);
    return totals;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {prepaid
            ? 'Manage your shipping credits and payments.'
            : `You are charged per delivered order. ${formatPeriod(periodKey)} is still running and will be invoiced at the start of next month.`}
        </p>
      </div>

      {!prepaid && <section className="rounded-lg border border-border border-t-4 border-t-primary bg-card p-5 sm:p-6" aria-label="Billing overview">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-sm font-medium text-muted-foreground">Awaiting payment</p>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{Object.keys(outstandingTotals).length ? Object.entries(outstandingTotals).map(([unit, amount]) => <p key={unit}>{money(amount, unit)}</p>) : money(0, currency)}</div>
            <p className="mt-2 text-sm text-muted-foreground">{outstanding.length} unpaid invoice{outstanding.length === 1 ? '' : 's'}</p>
          </div>
          {outstanding.length > 0 && <a href="#invoices-to-pay" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Review & pay invoices</a>}
        </div>
        <div className="mt-5 border-t border-border pt-4"><span className="text-sm text-muted-foreground">{formatPeriod(periodKey)} so far</span><p className="mt-1 text-xl font-semibold tabular-nums">{money(Number(thisMonth._sum.amount ?? 0), currency)}</p><p className="mt-1 text-sm text-muted-foreground">{thisMonth._count} delivered orders{reversedCount > 0 && ` · ${reversedCount} returned and credited`}</p></div>
      </section>}

      {prepaid && (
        <>
          {wallet && wallet.spendable <= 0 && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
              <p className="font-semibold text-red-600 dark:text-red-400">Shipping is paused</p>
              <p className="mt-1 text-sm text-red-600/90 dark:text-red-400/90">
                You have no credit left. Buy credits below to start shipping again — orders already on their
                way are unaffected.
              </p>
            </div>
          )}

          {!wallet && <p role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Your credit balance is temporarily unavailable. Refresh the page to try again.</p>}
          <section className="space-y-3 rounded-lg border border-border border-t-4 border-t-primary bg-card p-5 sm:p-6">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="py-3">
                <div className="text-sm font-medium text-muted-foreground">Available</div>
                <div
                  className={`mt-2 text-3xl font-semibold tabular-nums ${
                    wallet && wallet.spendable <= 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                  }`}
                >
                  {wallet ? formatCredits(wallet.available) : 'Unavailable'}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  credits
                  {wallet && wallet.shipmentsRemaining != null &&
                    ` · about ${wallet.shipmentsRemaining.toLocaleString('en-LK')} more order${
                      wallet.shipmentsRemaining === 1 ? '' : 's'
                    }`}
                </div>
              </div>

              <div className="py-3">
                <div className="text-sm font-medium text-muted-foreground">Reserved</div>
                <div className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
                  {wallet ? formatCredits(wallet.held) : 'Unavailable'}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  held against orders in transit — returned to you if they do not deliver
                </div>
              </div>

            </div>
            <p className="text-sm text-muted-foreground">Credits are reserved when you ship, charged on delivery, and returned if an order does not deliver.</p>
            {!creditPrice && <p className="text-sm text-muted-foreground">Credit purchases are unavailable until a credit price is set. Contact your administrator.</p>}

            {topUps.length > 0 && (
              <details className="border-t border-border pt-3"><summary className="cursor-pointer text-sm font-medium">Recent credit purchases · {topUps.length}</summary><p className="my-3 text-xs text-muted-foreground">Your latest 10 purchase requests.</p><div className="overflow-x-auto rounded-lg border border-border">
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
                          {topUp.createdAt.toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' })}
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
              </div></details>
            )}
          </section>

          <HistoryFilters filters={searchParams} prepaid={prepaid} />
          <details id="credit-history" className="space-y-3 rounded-lg border border-border p-4" open={Boolean(searchParams.activity || searchParams.from || searchParams.to || searchParams.creditPage)}>
            <summary className="cursor-pointer font-semibold text-foreground">Credit activity</summary>
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
                        No credit activity matches these filters.
                      </td>
                    </tr>
                  )}
                  {ledger.map((entry) => (
                    <tr key={entry.id}>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {entry.createdAt.toLocaleString('en-LK', { timeZone: 'Asia/Colombo' })}
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
            <nav aria-label="Credit activity pages" className="flex items-center justify-between gap-3 text-sm">
              {creditPage > 1 ? <Link className="underline underline-offset-4" href={historyLink(searchParams, 'creditPage', creditPage - 1)}>Previous</Link> : <span />}
              <span>Page {creditPage}</span>{ledgerRows.length > 25 ? <Link className="underline underline-offset-4" href={historyLink(searchParams, 'creditPage', creditPage + 1)}>Next</Link> : <span />}
            </nav>
          </details>
        </>
      )}

      <details className="rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">Rates & billing details</summary>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p><span className="font-medium text-foreground">Your delivery rate:</span> {rate ? describeRate(rate) : 'No rate set yet'}{rate?.note && ` · ${rate.note}`}</p>
          {prepaid && <><p><span className="font-medium text-foreground">Credit price:</span> {creditPrice ? `${money(Number(creditPrice.unitPrice), creditPrice.currency)} each · minimum ${formatCredits(creditPrice.minimumPurchaseCredits)} credits per purchase` : 'Not set'}</p><p><span className="font-medium text-foreground">Available to spend:</span> {wallet ? `${formatCredits(wallet.spendable)} credits` : 'Unavailable'}</p><p>{formatPeriod(periodKey)} delivery charges: {money(Number(thisMonth._sum.amount ?? 0), currency)} · {thisMonth._count} delivered orders{reversedCount > 0 && ` · ${reversedCount} returned and credited`}</p></>}
        </div>
      </details>

      {outstanding.length > 0 && (
        <section id="invoices-to-pay" className="space-y-3">
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
                      {invoice.dueAt && ` · due ${invoice.dueAt.toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' })}`}
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

      {!prepaid && <HistoryFilters filters={searchParams} prepaid={prepaid} />}
      <section id="invoice-history" className="space-y-3">
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
                    No invoices match these filters.
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
                  <td className="px-4 py-3 text-sm text-muted-foreground">{invoice.status === 'ISSUED' ? 'Awaiting payment' : invoice.status === 'PAID' ? 'Paid' : 'Voided'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <nav aria-label="Invoice history pages" className="flex items-center justify-between gap-3 text-sm">
          {invoicePage > 1 ? <Link className="underline underline-offset-4" href={historyLink(searchParams, 'invoicePage', invoicePage - 1)}>Previous</Link> : <span />}
          <span>Page {invoicePage}</span>{invoiceRows.length > 12 ? <Link className="underline underline-offset-4" href={historyLink(searchParams, 'invoicePage', invoicePage + 1)}>Next</Link> : <span />}
        </nav>
      </section>

      <details className="space-y-3 rounded-lg border border-border p-4">
        <summary className="cursor-pointer font-semibold text-foreground">This month&apos;s charges</summary><p className="text-xs text-muted-foreground">Latest 25 charges for {formatPeriod(periodKey)}.</p>
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
                    {charge.deliveredAt.toLocaleDateString('en-LK', { timeZone: 'Asia/Colombo' })}
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
      </details>
    </div>
  );
}
