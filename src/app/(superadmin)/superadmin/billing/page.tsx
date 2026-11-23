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
        title="Billing"
        description={`Tenants pay a fee for every delivered order. ${formatPeriod(periodKey)} is invoiced automatically on the 1st of next month.`}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <Stat label="Charged so far this month" value={money(periodTotal)} hint={`${periodOrders.toLocaleString()} deliveries`} />
        <Stat label="Unpaid invoices" value={money(outstandingTotal)} tone={outstandingTotal > 0 ? 'warn' : 'default'} />
        <Stat
          label="Tenants out of credit"
          value={emptyWallets.toLocaleString()}
          tone={emptyWallets > 0 ? 'warn' : 'default'}
          hint={prepaidTenants.length ? "Can't ship until they top up" : 'No prepaid tenants'}
        />
        <Stat
          label="Tenants without a rate"
          value={unpriced.toLocaleString()}
          tone={unpriced > 0 ? 'bad' : 'good'}
          hint="Their deliveries are not charged"
        />
      </div>

      {awaitingTopUps.length > 0 && (
        <Card
          title="Credit top-ups to approve"
          description="Check the money arrived in the bank, then approve. Credits are added to the tenant only after you approve."
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

      {pendingPayments.length > 0 && (
        <Card title="Invoice payments to confirm" description="The tenant says they paid. Check the money arrived in the bank, then confirm." flush>
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

      {unbilled.length > 0 && (
        <section className="overflow-hidden rounded-md border border-red-300 bg-red-50 shadow-sm">
          <div className="border-b border-red-200 px-5 py-4">
            <h2 className="font-bold text-red-800">
              {unbilledTotal.toLocaleString()} delivered order{unbilledTotal === 1 ? ' was' : 's were'} not charged
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-700">
              These tenants had no fee rate when the orders were delivered. Set a rate so future deliveries are
              charged — a new rate does not apply to past deliveries.
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

      <Card title="All tenants" description="Click a tenant to change their rate, credits or invoices." flush>
        <div className="overflow-x-auto">
          <table className={saTable}>
            <thead className={saThead}>
              <tr>
                <th className={saTh}>Tenant</th>
                <th className={saTh}>Fee rate</th>
                <th className={`${saTh} text-right`}>Deliveries this month</th>
                <th className={`${saTh} text-right`}>Charged this month</th>
                <th className={`${saTh} text-right`}>Unpaid</th>
                <th className={`${saTh} text-right`}>Credits left</th>
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
                      {rate ? describeRate(rate) : <span className="font-semibold text-red-700">No rate set</span>}
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
                        <span className="text-slate-400">Pays by invoice</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card
        title="Credit price for all tenants"
        description="The default price of one credit. To give one tenant a different price, open their billing page."
      >
        <CreditPriceForm
          currentUnitPrice={creditPrice ? Number(creditPrice.unitPrice) : undefined}
          currentMinimum={creditPrice ? Number(creditPrice.minimumPurchaseCredits) : undefined}
          currency={creditPrice?.currency ?? 'LKR'}
        />
      </Card>

    </div>
  );
}
