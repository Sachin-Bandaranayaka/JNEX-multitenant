// src/app/(superadmin)/superadmin/billing/page.tsx

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChargeStatus, TenantInvoiceStatus } from '@prisma/client';
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

  const [tenants, accruedByTenant, outstandingByTenant, pendingPayments] = await Promise.all([
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
  ]);

  const accrued = new Map(accruedByTenant.map((row) => [row.tenantId, row]));
  const outstanding = new Map(outstandingByTenant.map((row) => [row.tenantId, row]));

  const periodTotal = accruedByTenant.reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);
  const periodOrders = accruedByTenant.reduce((sum, row) => sum + row._count, 0);
  const outstandingTotal = outstandingByTenant.reduce((sum, row) => sum + Number(row._sum.total ?? 0), 0);
  const unpriced = tenants.filter((tenant) => tenant.feeRates.length === 0).length;

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
          <div className="text-sm font-medium text-gray-400">Tenants without a rate</div>
          <div className={`mt-2 text-3xl font-semibold ${unpriced > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {unpriced}
          </div>
        </div>
      </div>

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
