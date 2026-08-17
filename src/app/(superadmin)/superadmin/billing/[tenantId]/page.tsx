// src/app/(superadmin)/superadmin/billing/[tenantId]/page.tsx

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChargeStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatPeriod, periodKeyFor, previousPeriodKey } from '@/lib/billing/period';
import { describeRate } from '@/lib/billing/rates';
import { invoiceReference } from '@/lib/billing/invoicing';
import { RateForm } from './rate-form';
import { closePeriodForTenant } from '../actions';

function money(amount: string | number, currency = 'LKR') {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return `${currency} ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const chargeStatusStyles: Record<ChargeStatus, string> = {
  ACCRUED: 'bg-blue-500/10 text-blue-300',
  INVOICED: 'bg-amber-500/10 text-amber-300',
  PAID: 'bg-green-500/10 text-green-300',
  REVERSED: 'bg-red-500/10 text-red-300',
  WAIVED: 'bg-gray-500/10 text-gray-300',
};

export default async function TenantBillingPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const currentPeriod = periodKeyFor(new Date());
  const lastPeriod = previousPeriodKey(currentPeriod);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, businessName: true, isActive: true },
  });
  if (!tenant) notFound();

  const [rates, charges, invoices, periodSummary] = await Promise.all([
    prisma.tenantFeeRate.findMany({
      where: { tenantId },
      orderBy: { effectiveFrom: 'desc' },
      include: { _count: { select: { charges: true } } },
    }),
    prisma.deliveryCharge.findMany({
      where: { tenantId },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
      include: { order: { select: { number: true, customerName: true, total: true } } },
    }),
    prisma.tenantInvoice.findMany({
      where: { tenantId },
      orderBy: { periodKey: 'desc' },
      take: 12,
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.deliveryCharge.groupBy({
      by: ['status'],
      where: { tenantId, periodKey: currentPeriod },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const activeRate = rates.find((rate) => rate.effectiveTo === null);
  const currency = activeRate?.currency ?? charges[0]?.currency ?? 'LKR';
  const accruedNow = periodSummary.find((row) => row.status === ChargeStatus.ACCRUED);
  const hasUninvoicedLastMonth = charges.some(
    (charge) => charge.periodKey === lastPeriod && charge.status === ChargeStatus.ACCRUED,
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/superadmin/billing" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← All tenants
        </Link>
        <h1 className="mt-2 text-2xl font-bold leading-6 text-white">
          {tenant.businessName || tenant.name}
        </h1>
        <p className="mt-2 text-sm text-gray-300">
          {activeRate ? describeRate(activeRate) : 'No rate in force — deliveries are not being billed.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">{formatPeriod(currentPeriod)} so far</div>
          <div className="mt-2 text-3xl font-semibold text-white">
            {money(Number(accruedNow?._sum.amount ?? 0), currency)}
          </div>
          <div className="mt-1 text-sm text-gray-500">{accruedNow?._count ?? 0} billable deliveries</div>
        </div>
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Rate versions</div>
          <div className="mt-2 text-3xl font-semibold text-white">{rates.length}</div>
        </div>
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Invoices issued</div>
          <div className="mt-2 text-3xl font-semibold text-white">{invoices.length}</div>
        </div>
      </div>

      <RateForm tenantId={tenant.id} currency={currency} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Rate history</h2>
        <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-gray-800/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Terms</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">In force</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Charges</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/40">
              {rates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                    No rate has ever been set for this tenant.
                  </td>
                </tr>
              )}
              {rates.map((rate) => (
                <tr key={rate.id}>
                  <td className="px-4 py-3 text-sm text-white">{describeRate(rate)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {rate.effectiveFrom.toLocaleDateString('en-LK')} →{' '}
                    {rate.effectiveTo
                      ? rate.effectiveTo.toLocaleDateString('en-LK')
                      : <span className="text-green-400">now</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-300">{rate._count.charges}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{rate.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Invoices</h2>
          {hasUninvoicedLastMonth && (
            <form action={closePeriodForTenant}>
              <input type="hidden" name="tenantId" value={tenant.id} />
              <input type="hidden" name="periodKey" value={lastPeriod} />
              <button
                type="submit"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Issue {formatPeriod(lastPeriod)} invoice
              </button>
            </form>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-gray-800/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Period</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Orders</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Adjustments</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/40">
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                    Nothing invoiced yet.
                  </td>
                </tr>
              )}
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-3 font-mono text-sm text-gray-300">{invoiceReference(invoice)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{formatPeriod(invoice.periodKey)}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-300">{invoice.chargeCount}</td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-300">
                    {Number(invoice.adjustments) === 0 ? '—' : money(invoice.adjustments.toFixed(2), invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-white">
                    {money(invoice.total.toFixed(2), invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="text-gray-300">{invoice.status}</span>
                    {invoice.payments[0]?.status === 'PENDING' && (
                      <span className="ml-2 text-xs text-amber-400">transfer awaiting review</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Recent charges</h2>
        <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-gray-800/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Delivered</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Order</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Order value</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">Fee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-gray-900/40">
              {charges.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                    No charges recorded yet.
                  </td>
                </tr>
              )}
              {charges.map((charge) => (
                <tr key={charge.id}>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {charge.deliveredAt.toLocaleDateString('en-LK')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    #{charge.order.number} · {charge.order.customerName}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-400">
                    {money(charge.orderTotal.toFixed(2), charge.currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm tabular-nums text-white">
                    {money(charge.amount.toFixed(2), charge.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chargeStatusStyles[charge.status]}`}>
                      {charge.status}
                    </span>
                    {charge.reversalReason && (
                      <div className="mt-1 text-xs text-gray-500">{charge.reversalReason}</div>
                    )}
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
