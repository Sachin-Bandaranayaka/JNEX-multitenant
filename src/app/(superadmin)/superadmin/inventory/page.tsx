export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { StockReceiptForm } from './stock-receipt-form';
import { StockControlPanel } from './stock-control-panel';
import { Card, EmptyState, PageHeader, Stat, saTable, saTd, saTh, saThead, saTr } from '../ui';

export default async function SuperAdminInventoryPage() {
  const [tenants, recent] = await Promise.all([
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
  ]);

  const options = tenants.map((tenant) => ({
    id: tenant.id,
    name: tenant.businessName || tenant.name,
    products: tenant.products,
  }));

  const activeProducts = options.flatMap((tenant) => tenant.products.filter((product) => product.isActive));
  const unitsOnHand = activeProducts.reduce((total, product) => total + product.stock, 0);
  const outOfStock = activeProducts.filter((product) => product.stock === 0).length;
  const lowStock = activeProducts.filter((product) => product.stock > 0 && product.stock <= product.lowStockAlert).length;

  return <div className="space-y-8">
    <PageHeader
      eyebrow="Stock custody"
      title="Inventory control"
      description="Full owner control over every tenant's stock: add, remove, or correct on-hand quantities and low-stock thresholds. Tenant users can view stock but cannot move it manually; store approvals and order lifecycle events remain automatic."
    />

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Tenants" value={options.length} hint="Active tenants under stock custody" />
      <Stat label="Units on hand" value={unitsOnHand.toLocaleString('en-LK')} hint="Across all active products" />
      <Stat label="Low stock" value={lowStock} tone={lowStock > 0 ? 'warn' : 'default'} hint="At or below the alert threshold" />
      <Stat label="Out of stock" value={outOfStock} tone={outOfStock > 0 ? 'bad' : 'default'} hint="Active products with zero units" />
    </div>

    <StockControlPanel tenants={options} />

    <StockReceiptForm tenants={options} />

    <Card title="Recent stock movements" description="The latest 50 ledger entries across every tenant" flush>
      <div className="overflow-x-auto">
        <table className={saTable}>
          <thead className={saThead}><tr>
            <th className={saTh}>Date</th>
            <th className={saTh}>Tenant</th>
            <th className={saTh}>Product</th>
            <th className={`${saTh} text-right`}>Change</th>
            <th className={`${saTh} text-right`}>Balance</th>
            <th className={saTh}>Details</th>
            <th className={saTh}>Recorded by</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200">
            {recent.length === 0 && <tr><td colSpan={7} className="p-0"><EmptyState title="No stock movements yet" description="Every owner adjustment, receipt, and order-driven movement will be listed here." /></td></tr>}
            {recent.map((movement) => <tr key={movement.id} className={saTr}>
              <td className={`${saTd} whitespace-nowrap text-slate-500`}>{movement.createdAt.toLocaleString('en-LK')}</td>
              <td className={`${saTd} font-semibold text-slate-900`}>{movement.tenant.businessName || movement.tenant.name}</td>
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
