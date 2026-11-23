export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { StockReceiptForm } from './stock-receipt-form';
import { StockControlPanel } from './stock-control-panel';
import { pendingCounts } from '../attention';
import { Card, EmptyState, PageHeader, Stat, saBtnGhost, saTable, saTd, saTh, saThead, saTr, tenantLabel } from '../ui';

export default async function SuperAdminInventoryPage() {
  const [tenants, recent, pending] = await Promise.all([
    prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        businessName: true,
        products: {
          orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
          select: { id: true, code: true, name: true, stock: true, lowStockAlert: true, isActive: true },
        },
      },
    }),
    prisma.stockAdjustment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        tenant: { select: { name: true, businessName: true } },
        product: { select: { code: true, name: true } },
        adjustedBy: { select: { name: true, email: true } },
      },
    }),
    pendingCounts(),
  ]);

  const options = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenantLabel(tenant),
    products: tenant.products,
  }));

  const activeProducts = options.flatMap((tenant) => tenant.products.filter((product) => product.isActive));
  const unitsOnHand = activeProducts.reduce((total, product) => total + product.stock, 0);
  const outOfStock = activeProducts.filter((product) => product.stock === 0).length;
  const lowStock = activeProducts.filter((product) => product.stock > 0 && product.stock <= product.lowStockAlert).length;

  return <div className="space-y-8">
    <PageHeader
      title="Stock levels"
      description="See and change stock for any tenant. Tenant staff can't change stock themselves — they send a request, and stock also moves automatically with orders and store purchases."
    >
      <Link href="/superadmin/inventory/requests" className={saBtnGhost}>
        Stock requests
        {pending.stockRequests > 0 && <span className="rounded-full bg-[#e10600] px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{pending.stockRequests}</span>}
      </Link>
    </PageHeader>

    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      <Stat label="Units in stock" value={unitsOnHand.toLocaleString('en-LK')} hint={`Across ${options.length} active tenants`} />
      <Stat label="Running low" value={lowStock} tone={lowStock > 0 ? 'warn' : 'default'} hint="At or below the alert level" />
      <Stat label="Out of stock" value={outOfStock} tone={outOfStock > 0 ? 'bad' : 'default'} />
    </div>

    <StockControlPanel tenants={options} />

    <details className="group rounded-md border border-slate-300 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-5 py-4 font-bold text-slate-900 hover:bg-slate-50">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90" aria-hidden>›</span>
        Record stock a tenant bought from their own supplier
      </summary>
      <div className="border-t border-slate-200 p-1">
        <StockReceiptForm tenants={options} />
      </div>
    </details>

    <Card title="Recent stock changes" description="The last 50 changes across all tenants" flush>
      <div className="overflow-x-auto">
        <table className={saTable}>
          <thead className={saThead}><tr>
            <th className={saTh}>Date</th>
            <th className={saTh}>Tenant</th>
            <th className={saTh}>Product</th>
            <th className={`${saTh} text-right`}>Change</th>
            <th className={`${saTh} text-right`}>Before → after</th>
            <th className={saTh}>Reason</th>
            <th className={saTh}>By</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200">
            {recent.length === 0 && <tr><td colSpan={7} className="p-0"><EmptyState title="No stock movements yet" description="Every owner adjustment, receipt, and order-driven movement will be listed here." /></td></tr>}
            {recent.map((movement) => <tr key={movement.id} className={saTr}>
              <td className={`${saTd} whitespace-nowrap text-slate-500`}>{movement.createdAt.toLocaleString('en-LK')}</td>
              <td className={`${saTd} font-semibold text-slate-900`}>{tenantLabel(movement.tenant)}</td>
              <td className={saTd}>{movement.product.code} · {movement.product.name}</td>
              <td className={`${saTd} text-right font-bold tabular-nums ${movement.quantity < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
              </td>
              <td className={`${saTd} text-right tabular-nums text-slate-500`}>{movement.previousStock} → {movement.newStock}</td>
              <td className={saTd}>{movement.reason}</td>
              <td className={`${saTd} text-slate-500`}>{movement.adjustedBy.name || movement.adjustedBy.email}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </Card>
  </div>;
}
