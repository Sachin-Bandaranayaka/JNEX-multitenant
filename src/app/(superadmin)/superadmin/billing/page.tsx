// src/app/(superadmin)/superadmin/billing/page.tsx

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { BillingMode, ChargeStatus, OrderStatus, TenantInvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { periodKeyFor, formatPeriod } from '@/lib/billing/period';
import { describeRate } from '@/lib/billing/rates';
import { invoiceReference } from '@/lib/billing/invoicing';
import { formatCredits, platformCreditPrice } from '@/lib/billing/credit-price';
import { pendingTopUps, topUpReference } from '@/lib/billing/topups';
import { PaymentReviewForm } from './payment-review-form';
import { TopUpReviewForm } from './top-up-review-form';
import { CreditPriceForm } from './credit-price-form';
import { Badge, Card, PageHeader, Stat, saTable, saTd, saTh, saThead, saTr, tenantLabel } from '../ui';

function money(amount: string | number, currency = 'LKR') {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return `${currency} ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function SuperAdminBillingPage() {
  const periodKey = periodKeyFor(new Date());

  const [tenants, accruedByTenant, outstandingByTenant, pendingPayments, unbilledByTenant, allTenants] = await Promise.all([
    prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        businessName: true,
        feeRates: {
          where: { effectiveTo: null },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.deliveryCharge.groupBy({
      by: ['tenantId'],
      where: { periodKey, status: ChargeStatus.ACCRUED },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.tenantInvoice.groupBy({
      by: ['tenantId'],
      where: { status: TenantInvoiceStatus.ISSUED },
      _sum: { total: true },
      _count: true,
    }),
    prisma.tenantInvoicePayment.findMany({
      where: { status: 'PENDING' },
      include: {
        tenant: { select: { name: true, businessName: true } },
        invoice: { select: { id: true, number: true, periodKey: true, total: true, currency: true } },
        submittedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    // Delivered orders that produced no charge at all. This is the number that
    // actually costs money: a tenant can deliver for weeks with no rate in
    // force and nothing else on this page would say so. Fees for a month the
    // tenant was never told about cannot fairly be reclaimed later, so this
    // needs to be caught in days, not at quarter close.
    prisma.order.groupBy({
      by: ['tenantId'],
      where: { status: OrderStatus.DELIVERED, deliveryCharge: null },
      _count: true,
      _min: { deliveredAt: true },
      _max: { deliveredAt: true },
    }),
    prisma.tenant.findMany({ select: { id: true, name: true, businessName: true } }),
  ]);

  const [creditPrice, awaitingTopUps, walletBalances, prepaidTenants] = await Promise.all([
    platformCreditPrice(),
    pendingTopUps(),
    // The newest ledger row per tenant carries the running balance, so one
    // grouped max is enough to sort the console without summing any ledgers.
    prisma.creditTransaction.groupBy({ by: ['tenantId'], _max: { seq: true } }),
    prisma.tenant.findMany({
      where: { billingMode: BillingMode.PREPAID },
      select: { id: true, minimumShipCredits: true, creditLimitCredits: true },
    }),
  ]);

  const latestRows = walletBalances.length
    ? await prisma.creditTransaction.findMany({
        where: { seq: { in: walletBalances.map((row) => row._max.seq as number).filter(Boolean) } },
        select: { tenantId: true, creditsAfter: true },
      })
    : [];
  const balances = new Map(latestRows.map((row) => [row.tenantId, Number(row.creditsAfter)]));
  const prepaidIds = new Set(prepaidTenants.map((tenant) => tenant.id));
  const emptyWallets = prepaidTenants.filter((tenant) => (balances.get(tenant.id) ?? 0) <= 0).length;

  const accrued = new Map(accruedByTenant.map((row) => [row.tenantId, row]));
  const outstanding = new Map(outstandingByTenant.map((row) => [row.tenantId, row]));

  const periodTotal = accruedByTenant.reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
  const periodOrders = accruedByTenant.reduce((sum, row) => sum + row._count, 0);
  const outstandingTotal = outstandingByTenant.reduce((sum, row) => sum + Number(row._sum.total ?? 0), 0);
  const unpriced = tenants.filter((tenant) => tenant.feeRates.length === 0).length;

  const tenantNames = new Map(allTenants.map((tenant) => [tenant.id, tenantLabel(tenant)]));
  const unbilled = [...unbilledByTenant].sort((a, b) => b._count - a._count);
  const unbilledTotal = unbilled.reduce((sum, row) => sum + row._count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Revenue desk"
        title="Billing"
        description={`Platform fees accrue per delivered order. ${formatPeriod(periodKey)} is still open — it is invoiced automatically on the 1st.`}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Accrued this month" value={money(periodTotal)} />
        <Stat label="Billable deliveries" value={periodOrders.toLocaleString()} />
        <Stat label="Awaiting payment" value={money(outstandingTotal)} tone={outstandingTotal > 0 ? 'warn' : 'default'} />
        <Stat
          label="Unbilled deliveries"
          value={unbilledTotal.toLocaleString()}
          tone={unbilledTotal > 0 ? 'bad' : 'good'}
          hint={`${unpriced} tenant${unpriced === 1 ? '' : 's'} without a rate`}
        />
      </div>

      {prepaidTenants.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Prepaid tenants" value={prepaidTenants.length.toLocaleString()} />
          <Stat
            label="Out of credit"
            value={emptyWallets.toLocaleString()}
            tone={emptyWallets > 0 ? 'warn' : 'good'}
            hint="cannot ship until they top up"
          />
          <Stat
            label="Top-ups to review"
            value={awaitingTopUps.length.toLocaleString()}
            tone={awaitingTopUps.length > 0 ? 'warn' : 'default'}
          />
          <Stat
            label="Credit price"
            value={creditPrice ? money(Number(creditPrice.unitPrice), creditPrice.currency) : 'Not set'}
            tone={creditPrice ? 'default' : 'bad'}
            hint="platform default"
          />
        </div>
      )}

      {awaitingTopUps.length > 0 && (
        <Card
          title="Credit purchases awaiting review"
          description={`${awaitingTopUps.length} submitted bank transfer${awaitingTopUps.length === 1 ? '' : 's'} — no credit reaches a wallet until one of these is confirmed`}
          flush
        >
          <div className="divide-y divide-slate-200">
            {awaitingTopUps.map((topUp) => (
              <div key={topUp.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-slate-900">
                      {tenantLabel(topUp.tenant)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {topUpReference(topUp)} · {formatCredits(topUp.credits)} credits ·{' '}
                      {money(topUp.amount.toFixed(2), topUp.currency)} at{' '}
                      {money(topUp.unitPrice.toFixed(2), topUp.currency)} each
                    </div>
                    <div className="text-sm text-slate-600">
                      Receipt <span className="font-mono text-slate-900">{topUp.bankReceiptNumber}</span> ·
                      transferred {topUp.transferTime.toLocaleString('en-LK')}
                    </div>
                    <div className="text-xs text-slate-500">
                      Submitted by {topUp.submittedBy.name || topUp.submittedBy.email} · WhatsApp{' '}
                      {topUp.whatsappNumber}
                    </div>
                  </div>
                  <TopUpReviewForm topUpId={topUp.id} requestedCredits={String(Number(topUp.credits))} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {unbilled.length > 0 && (
        <section className="overflow-hidden rounded-md border border-red-300 bg-red-50 shadow-sm">
          <div className="border-b border-red-200 px-5 py-4">
            <h2 className="font-bold text-red-800">
              {unbilledTotal.toLocaleString()} delivered order{unbilledTotal === 1 ? '' : 's'} produced no charge
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
              These deliveries had no fee rate in force at the time they were delivered, so nothing was billed.
              Setting a rate now only affects future deliveries — a rate cannot be applied backwards, and invoicing
              a tenant for months they were never quoted is not a conversation worth having. Fix the rate, then
              decide deliberately whether to backfill.
            </p>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className={saTable}>
              <thead className={saThead}>
                <tr>
                  <th className={saTh}>Tenant</th>
                  <th className={`${saTh} text-right`}>Unbilled</th>
                  <th className={saTh}>First</th>
                  <th className={saTh}>Most recent</th>
                  <th className={saTh} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {unbilled.map((row) => (
                  <tr key={row.tenantId} className={saTr}>
                    <td className={`${saTd} font-semibold text-slate-900`}>{tenantNames.get(row.tenantId) ?? row.tenantId}</td>
                    <td className={`${saTd} text-right font-bold tabular-nums text-red-700`}>{row._count.toLocaleString()}</td>
                    <td className={`${saTd} whitespace-nowrap text-slate-500`}>
                      {row._min.deliveredAt ? row._min.deliveredAt.toLocaleDateString('en-LK') : '—'}
                    </td>
                    <td className={`${saTd} whitespace-nowrap text-slate-500`}>
                      {row._max.deliveredAt ? row._max.deliveredAt.toLocaleDateString('en-LK') : '—'}
                    </td>
                    <td className={`${saTd} text-right`}>
                      <Link href={`/superadmin/billing/${row.tenantId}`} className="font-bold text-[#c50500] hover:underline">
                        Set rate →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pendingPayments.length > 0 && (
        <Card title="Transfers awaiting review" description={`${pendingPayments.length} submitted bank transfer${pendingPayments.length === 1 ? '' : 's'}`} flush>
          <div className="divide-y divide-slate-200">
            {pendingPayments.map((payment) => (
              <div key={payment.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-slate-900">
                      {tenantLabel(payment.tenant)}
                    </div>
                    <div className="text-sm text-slate-600">
                      {invoiceReference(payment.invoice)} · invoiced{' '}
                      {money(payment.invoice.total.toFixed(2), payment.invoice.currency)}
                    </div>
                    <div className="text-sm text-slate-600">
                      Paid {money(payment.amount.toFixed(2))} · receipt{' '}
                      <span className="font-mono text-slate-900">{payment.bankReceiptNumber}</span> ·
                      transferred {payment.transferTime.toLocaleString('en-LK')}
                    </div>
                    <div className="text-xs text-slate-500">
                      Submitted by {payment.submittedBy.name || payment.submittedBy.email} · WhatsApp{' '}
                      {payment.whatsappNumber}
                    </div>
                  </div>
                  <PaymentReviewForm paymentId={payment.id} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card
        title="Credit price"
        description="What one credit costs, platform-wide. Tenants can be given their own override on their billing page."
      >
        <CreditPriceForm
          currentUnitPrice={creditPrice ? Number(creditPrice.unitPrice) : undefined}
          currentMinimum={creditPrice ? Number(creditPrice.minimumPurchaseCredits) : undefined}
          currency={creditPrice?.currency ?? 'LKR'}
        />
      </Card>

      <Card title="Tenants" description="Current rate and month-to-date position" flush>
        <div className="overflow-x-auto">
          <table className={saTable}>
            <thead className={saThead}>
              <tr>
                <th className={saTh}>Tenant</th>
                <th className={saTh}>Current rate</th>
                <th className={`${saTh} text-right`}>Deliveries</th>
                <th className={`${saTh} text-right`}>Accrued</th>
                <th className={`${saTh} text-right`}>Unpaid</th>
                <th className={`${saTh} text-right`}>Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tenants.map((tenant) => {
                const rate = tenant.feeRates[0];
                const tenantAccrued = accrued.get(tenant.id);
                const tenantOutstanding = outstanding.get(tenant.id);
                return (
                  <tr key={tenant.id} className={saTr}>
                    <td className={saTd}>
                      <Link href={`/superadmin/billing/${tenant.id}`} className="font-bold text-[#c50500] hover:underline">
                        {tenantLabel(tenant)}
                      </Link>
                    </td>
                    <td className={saTd}>
                      {rate ? describeRate(rate) : <span className="font-semibold text-red-700">No rate — not billable</span>}
                    </td>
                    <td className={`${saTd} text-right tabular-nums`}>
                      {tenantAccrued?._count ?? 0}
                    </td>
                    <td className={`${saTd} text-right font-semibold tabular-nums text-slate-900`}>
                      {money(Number(tenantAccrued?._sum.amount ?? 0), rate?.currency)}
                    </td>
                    <td className={`${saTd} text-right tabular-nums`}>
                      {Number(tenantOutstanding?._sum.total ?? 0) > 0 ? (
                        <span className="font-semibold text-amber-700">
                          {money(Number(tenantOutstanding?._sum.total ?? 0), rate?.currency)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className={`${saTd} text-right tabular-nums`}>
                      {prepaidIds.has(tenant.id) ? (
                        (balances.get(tenant.id) ?? 0) > 0 ? (
                          <span className="font-semibold text-slate-900">
                            {formatCredits(balances.get(tenant.id) ?? 0)}
                          </span>
                        ) : (
                          <Badge tone="red">Out of credit</Badge>
                        )
                      ) : (
                        <span className="text-slate-400">Postpaid</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
