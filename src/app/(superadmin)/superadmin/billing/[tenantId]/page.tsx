// src/app/(superadmin)/superadmin/billing/[tenantId]/page.tsx

export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { BillingMode, ChargeStatus, CreditTxType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatPeriod, periodKeyFor, previousPeriodKey } from '@/lib/billing/period';
import { describeRate } from '@/lib/billing/rates';
import { invoiceReference } from '@/lib/billing/invoicing';
import { getWalletSummary } from '@/lib/billing/credits';
import { currentCreditPrice, formatCredits, listCreditPrices } from '@/lib/billing/credit-price';
import { listTopUps, topUpReference } from '@/lib/billing/topups';
import { RateForm } from './rate-form';
import { CreditPriceForm } from '../credit-price-form';
import { AdjustCreditsForm, CreditPolicyForm } from '../credit-policy-form';
import { closePeriodForTenant } from '../actions';
import { Badge, Card, PageHeader, Stat, saBtnPrimary, saTable, saTd, saTh, saThead, saTr } from '../../ui';

function money(amount: string | number, currency = 'LKR') {
  const value = typeof amount === 'string' ? Number(amount) : amount;
  return `${currency} ${value.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Ledger types in plain language, matching what the tenant is shown. */
const CREDIT_ACTIVITY: Record<CreditTxType, string> = {
  TOPUP: 'Credits purchased',
  HOLD: 'Reserved on shipment',
  RELEASE: 'Reservation returned',
  CAPTURE: 'Delivery fee',
  REFUND: 'Refunded after return',
  ADJUSTMENT: 'Adjustment',
};

const chargeStatusStyles: Record<ChargeStatus, string> = {
  ACCRUED: 'bg-blue-50 text-blue-800',
  INVOICED: 'bg-amber-50 text-amber-800',
  PAID: 'bg-emerald-50 text-emerald-700',
  REVERSED: 'bg-red-50 text-red-700',
  WAIVED: 'bg-slate-100 text-slate-700',
};

export default async function TenantBillingPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const currentPeriod = periodKeyFor(new Date());
  const lastPeriod = previousPeriodKey(currentPeriod);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      businessName: true,
      isActive: true,
      billingMode: true,
      creditLimitCredits: true,
      minimumShipCredits: true,
      lowBalanceCredits: true,
    },
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

  const [wallet, effectivePrice, priceHistory, topUps, ledger] = await Promise.all([
    getWalletSummary(tenantId),
    currentCreditPrice(tenantId),
    listCreditPrices(tenantId),
    listTopUps(tenantId, 10),
    prisma.creditTransaction.findMany({
      where: { tenantId },
      orderBy: { seq: 'desc' },
      take: 50,
      include: { order: { select: { number: true } } },
    }),
  ]);
  const tenantOverride = priceHistory.find((price) => price.effectiveTo === null);
  const prepaid = tenant.billingMode === BillingMode.PREPAID;

  const activeRate = rates.find((rate) => rate.effectiveTo === null);
  const currency = activeRate?.currency ?? charges[0]?.currency ?? 'LKR';
  const accruedNow = periodSummary.find((row) => row.status === ChargeStatus.ACCRUED);
  const hasUninvoicedLastMonth = charges.some(
    (charge) => charge.periodKey === lastPeriod && charge.status === ChargeStatus.ACCRUED,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tenant billing"
        title={tenant.businessName || tenant.name}
        description={activeRate ? describeRate(activeRate) : 'No rate in force — deliveries are not being billed.'}
        backHref="/superadmin/billing"
        backLabel="All tenants"
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <Stat
          label={`${formatPeriod(currentPeriod)} so far`}
          value={money(Number(accruedNow?._sum.amount ?? 0), currency)}
          hint={`${accruedNow?._count ?? 0} billable deliveries`}
        />
        <Stat label="Rate versions" value={rates.length} />
        <Stat label="Invoices issued" value={invoices.length} />
      </div>

      {prepaid && (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Stat
              label="Credit balance"
              value={formatCredits(wallet.available)}
              tone={wallet.spendable > 0 ? 'default' : 'bad'}
              hint={
                wallet.shipmentsRemaining != null
                  ? `about ${wallet.shipmentsRemaining.toLocaleString()} more orders`
                  : undefined
              }
            />
            <Stat label="Reserved in transit" value={formatCredits(wallet.held)} />
            <Stat
              label="Credit price"
              value={wallet.unitPrice != null ? money(wallet.unitPrice, wallet.currency) : 'Not set'}
              tone={wallet.unitPrice != null ? 'default' : 'bad'}
              hint={tenantOverride ? 'tenant override' : 'platform default'}
            />
          </div>

          <Card title="Credit ledger" description="Every movement, newest first" flush>
            <div className="overflow-x-auto">
              <table className={saTable}>
                <thead className={saThead}>
                  <tr>
                    <th className={saTh}>When</th>
                    <th className={saTh}>Movement</th>
                    <th className={saTh}>Reason</th>
                    <th className={`${saTh} text-right`}>Credits</th>
                    <th className={`${saTh} text-right`}>Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                        Nothing in this wallet yet.
                      </td>
                    </tr>
                  )}
                  {ledger.map((entry) => (
                    <tr key={entry.id} className={saTr}>
                      <td className={`${saTd} whitespace-nowrap text-slate-500`}>
                        {entry.createdAt.toLocaleString('en-LK')}
                      </td>
                      <td className={`${saTd} font-semibold text-slate-900`}>
                        {CREDIT_ACTIVITY[entry.type]}
                        {entry.order && ` · #${entry.order.number}`}
                      </td>
                      <td className={`${saTd} text-slate-500`}>{entry.reason || '—'}</td>
                      <td
                        className={`${saTd} text-right font-semibold tabular-nums ${
                          Number(entry.credits) < 0 ? 'text-slate-900' : 'text-emerald-700'
                        }`}
                      >
                        {Number(entry.credits) > 0 ? '+' : ''}
                        {formatCredits(entry.credits)}
                      </td>
                      <td className={`${saTd} text-right tabular-nums text-slate-500`}>
                        {formatCredits(entry.creditsAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {topUps.length > 0 && (
            <Card title="Credit purchases" flush>
              <div className="overflow-x-auto">
                <table className={saTable}>
                  <thead className={saThead}>
                    <tr>
                      <th className={saTh}>Reference</th>
                      <th className={saTh}>Submitted</th>
                      <th className={`${saTh} text-right`}>Credits</th>
                      <th className={`${saTh} text-right`}>Amount</th>
                      <th className={saTh}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {topUps.map((topUp) => (
                      <tr key={topUp.id} className={saTr}>
                        <td className={`${saTd} font-mono text-slate-500`}>{topUpReference(topUp)}</td>
                        <td className={saTd}>{topUp.createdAt.toLocaleDateString('en-LK')}</td>
                        <td className={`${saTd} text-right tabular-nums`}>
                          {formatCredits(topUp.creditedCredits ?? topUp.credits)}
                        </td>
                        <td className={`${saTd} text-right tabular-nums`}>
                          {money(topUp.amount.toFixed(2), topUp.currency)}
                        </td>
                        <td className={saTd}>
                          {topUp.status === 'CONFIRMED' ? (
                            <Badge tone="green">Credited</Badge>
                          ) : topUp.status === 'PENDING' ? (
                            <Badge tone="amber">Awaiting review</Badge>
                          ) : (
                            <Badge tone="red">Rejected</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="Adjust credits" description="Goodwill, a bank error, or an opening balance on migration">
            <AdjustCreditsForm tenantId={tenant.id} />
          </Card>
        </>
      )}

      <Card
        title="Billing mode and credit policy"
        description="How this tenant pays, and what stops them shipping"
      >
        <CreditPolicyForm
          tenantId={tenant.id}
          billingMode={tenant.billingMode}
          creditLimitCredits={Number(tenant.creditLimitCredits)}
          minimumShipCredits={tenant.minimumShipCredits == null ? null : Number(tenant.minimumShipCredits)}
          lowBalanceCredits={tenant.lowBalanceCredits == null ? null : Number(tenant.lowBalanceCredits)}
          hasCreditPrice={effectivePrice != null}
        />
      </Card>

      <Card
        title="Credit price override"
        description="Leave this alone unless this tenant buys credit at a different price from everyone else"
      >
        <CreditPriceForm
          tenantId={tenant.id}
          currentUnitPrice={effectivePrice ? Number(effectivePrice.unitPrice) : undefined}
          currentMinimum={effectivePrice ? Number(effectivePrice.minimumPurchaseCredits) : undefined}
          currency={effectivePrice?.currency ?? currency}
          flatFee={activeRate?.flatAmount == null ? null : Number(activeRate.flatAmount)}
          inheritedFrom={tenantOverride ? null : 'platform'}
        />
      </Card>

      <RateForm tenantId={tenant.id} currency={currency} />

      <Card title="Rate history" description="Every version of this tenant's terms" flush>
        <div className="overflow-x-auto">
          <table className={saTable}>
            <thead className={saThead}>
              <tr>
                <th className={saTh}>Terms</th>
                <th className={saTh}>In force</th>
                <th className={`${saTh} text-right`}>Charges</th>
                <th className={saTh}>Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rates.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                    No rate has ever been set for this tenant.
                  </td>
                </tr>
              )}
              {rates.map((rate) => (
                <tr key={rate.id} className={saTr}>
                  <td className={`${saTd} font-semibold text-slate-900`}>{describeRate(rate)}</td>
                  <td className={saTd}>
                    {rate.effectiveFrom.toLocaleDateString('en-LK')} →{' '}
                    {rate.effectiveTo
                      ? rate.effectiveTo.toLocaleDateString('en-LK')
                      : <span className="font-semibold text-emerald-700">now</span>}
                  </td>
                  <td className={`${saTd} text-right tabular-nums`}>{rate._count.charges}</td>
                  <td className={`${saTd} text-slate-500`}>{rate.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="Invoices"
        description="Issued statements and their payment state"
        flush
        actions={hasUninvoicedLastMonth ? (
          <form action={closePeriodForTenant}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <input type="hidden" name="periodKey" value={lastPeriod} />
            <button type="submit" className={saBtnPrimary}>
              Issue {formatPeriod(lastPeriod)} invoice
            </button>
          </form>
        ) : undefined}
      >
        <div className="overflow-x-auto">
          <table className={saTable}>
            <thead className={saThead}>
              <tr>
                <th className={saTh}>Invoice</th>
                <th className={saTh}>Period</th>
                <th className={`${saTh} text-right`}>Orders</th>
                <th className={`${saTh} text-right`}>Adjustments</th>
                <th className={`${saTh} text-right`}>Total</th>
                <th className={saTh}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    Nothing invoiced yet.
                  </td>
                </tr>
              )}
              {invoices.map((invoice) => (
                <tr key={invoice.id} className={saTr}>
                  <td className={`${saTd} font-mono`}>{invoiceReference(invoice)}</td>
                  <td className={saTd}>{formatPeriod(invoice.periodKey)}</td>
                  <td className={`${saTd} text-right tabular-nums`}>{invoice.chargeCount}</td>
                  <td className={`${saTd} text-right tabular-nums`}>
                    {Number(invoice.adjustments) === 0 ? '—' : money(invoice.adjustments.toFixed(2), invoice.currency)}
                  </td>
                  <td className={`${saTd} text-right font-semibold tabular-nums text-slate-900`}>
                    {money(invoice.total.toFixed(2), invoice.currency)}
                  </td>
                  <td className={saTd}>
                    <span className="font-semibold text-slate-700">{invoice.status}</span>
                    {invoice.payments[0]?.status === 'PENDING' && (
                      <span className="ml-2 text-xs font-semibold text-amber-700">transfer awaiting review</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Recent charges" description="The latest 50 delivery fees" flush>
        <div className="overflow-x-auto">
          <table className={saTable}>
            <thead className={saThead}>
              <tr>
                <th className={saTh}>Delivered</th>
                <th className={saTh}>Order</th>
                <th className={`${saTh} text-right`}>Order value</th>
                <th className={`${saTh} text-right`}>Fee</th>
                <th className={saTh}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {charges.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                    No charges recorded yet.
                  </td>
                </tr>
              )}
              {charges.map((charge) => (
                <tr key={charge.id} className={saTr}>
                  <td className={saTd}>
                    {charge.deliveredAt.toLocaleDateString('en-LK')}
                  </td>
                  <td className={saTd}>
                    #{charge.order.number} · {charge.order.customerName}
                  </td>
                  <td className={`${saTd} text-right tabular-nums text-slate-500`}>
                    {money(charge.orderTotal.toFixed(2), charge.currency)}
                  </td>
                  <td className={`${saTd} text-right font-semibold tabular-nums text-slate-900`}>
                    {money(charge.amount.toFixed(2), charge.currency)}
                  </td>
                  <td className={saTd}>
                    <span className={`inline-flex rounded px-2 py-1 text-[11px] font-bold ${chargeStatusStyles[charge.status]}`}>
                      {charge.status}
                    </span>
                    {charge.reversalReason && (
                      <div className="mt-1 text-xs text-slate-500">{charge.reversalReason}</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
