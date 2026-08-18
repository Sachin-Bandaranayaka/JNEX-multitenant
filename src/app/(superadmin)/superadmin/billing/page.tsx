// src/app/(superadmin)/superadmin/billing/page.tsx

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChargeStatus, OrderStatus, TenantInvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { periodKeyFor, formatPeriod } from '@/lib/billing/period';
import { describeRate } from '@/lib/billing/rates';
import { invoiceReference } from '@/lib/billing/invoicing';
import { PaymentReviewForm } from './payment-review-form';

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

  const accrued = new Map(accruedByTenant.map((row) => [row.tenantId, row]));
  const outstanding = new Map(outstandingByTenant.map((row) => [row.tenantId, row]));

  const periodTotal = accruedByTenant.reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
  const periodOrders = accruedByTenant.reduce((sum, row) => sum + row._count, 0);
  const outstandingTotal = outstandingByTenant.reduce((sum, row) => sum + Number(row._sum.total ?? 0), 0);
  const unpriced = tenants.filter((tenant) => tenant.feeRates.length === 0).length;

  const tenantNames = new Map(allTenants.map((tenant) => [tenant.id, tenant.businessName || tenant.name]));
  const unbilled = [...unbilledByTenant].sort((a, b) => b._count - a._count);
  const unbilledTotal = unbilled.reduce((sum, row) => sum + row._count, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold leading-6 text-white">Billing</h1>
        <p className="mt-2 text-sm text-gray-300">
          Platform fees accrue per delivered order. {formatPeriod(periodKey)} is still open — it is invoiced
          automatically on the 1st.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Accrued this month</div>
          <div className="mt-2 text-3xl font-semibold text-white">{money(periodTotal)}</div>
        </div>
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Billable deliveries</div>
          <div className="mt-2 text-3xl font-semibold text-white">{periodOrders.toLocaleString()}</div>
        </div>
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Awaiting payment</div>
          <div className="mt-2 text-3xl font-semibold text-amber-400">{money(outstandingTotal)}</div>
        </div>
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Unbilled deliveries</div>
          <div className={`mt-2 text-3xl font-semibold ${unbilledTotal > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {unbilledTotal.toLocaleString()}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            {unpriced} tenant{unpriced === 1 ? '' : 's'} without a rate
          </div>
        </div>
      </div>

      {unbilled.length > 0 && (
        <section className="space-y-3 rounded-lg border border-red-500/30 bg-red-950/20 p-5">
          <div>
            <h2 className="text-lg font-semibold text-red-300">
              {unbilledTotal.toLocaleString()} delivered order{unbilledTotal === 1 ? '' : 's'} produced no charge
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              These deliveries had no fee rate in force at the time they were delivered, so nothing was billed.
              Setting a rate now only affects future deliveries — a rate cannot be applied backwards, and invoicing
              a tenant for months they were never quoted is not a conversation worth having. Fix the rate, then
              decide deliberately whether to backfill.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-gray-900/60">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Tenant</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Unbilled</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">First</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Most recent</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-gray-900/40">
                {unbilled.map((row) => (
                  <tr key={row.tenantId}>
                    <td className="px-4 py-2 text-sm text-white">{tenantNames.get(row.tenantId) ?? row.tenantId}</td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums text-red-300">{row._count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm text-gray-400">
                      {row._min.deliveredAt ? row._min.deliveredAt.toLocaleDateString('en-LK') : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-400">
                      {row._max.deliveredAt ? row._max.deliveredAt.toLocaleDateString('en-LK') : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link href={`/superadmin/billing/${row.tenantId}`} className="text-sm text-indigo-400 hover:text-indigo-300">
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
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Transfers awaiting review</h2>
          <div className="space-y-3">
            {pendingPayments.map((payment) => (
              <div key={payment.id} className="rounded-lg bg-gray-800/80 p-5 ring-1 ring-white/10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-white">
                      {payment.tenant.businessName || payment.tenant.name}
                    </div>
                    <div className="text-sm text-gray-400">
                      {invoiceReference(payment.invoice)} · invoiced{' '}
                      {money(payment.invoice.total.toFixed(2), payment.invoice.currency)}
                    </div>
                    <div className="text-sm text-gray-400">
                      Paid {money(payment.amount.toFixed(2))} · receipt{' '}
                      <span className="font-mono text-gray-200">{payment.bankReceiptNumber}</span> ·
                      transferred {payment.transferTime.toLocaleString('en-LK')}
                    </div>
                    <div className="text-sm text-gray-500">
                      Submitted by {payment.submittedBy.name || payment.submittedBy.email} · WhatsApp{' '}
                      {payment.whatsappNumber}
                    </div>
                  </div>
                  <PaymentReviewForm paymentId={payment.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Tenants</h2>
        <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-gray-800/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Current rate</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Deliveries</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Accrued</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Unpaid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/40">
              {tenants.map((tenant) => {
                const rate = tenant.feeRates[0];
                const tenantAccrued = accrued.get(tenant.id);
                const tenantOutstanding = outstanding.get(tenant.id);
                return (
                  <tr key={tenant.id} className="hover:bg-gray-800/60">
                    <td className="px-4 py-3">
                      <Link href={`/superadmin/billing/${tenant.id}`} className="font-medium text-indigo-400 hover:text-indigo-300">
                        {tenant.businessName || tenant.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {rate ? describeRate(rate) : <span className="text-red-400">No rate — not billable</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-300">
                      {tenantAccrued?._count ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-white">
                      {money(Number(tenantAccrued?._sum.amount ?? 0), rate?.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums">
                      {Number(tenantOutstanding?._sum.total ?? 0) > 0 ? (
                        <span className="text-amber-400">
                          {money(Number(tenantOutstanding?._sum.total ?? 0), rate?.currency)}
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
