export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { StockReceiptForm } from './stock-receipt-form';
import { Card, EmptyState, PageHeader, saTable, saTd, saTh, saThead, saTr } from '../ui';

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
          where: { isActive: true },
          orderBy: { name: 'asc' },
          select: { id: true, code: true, name: true, stock: true },
        },
      },
    }),
    prisma.stockAdjustment.findMany({
      where: { reason: { startsWith: 'Own supplier:' } },
      orderBy: { createdAt: 'desc' },
      take: 25,
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

  return <div className="space-y-8">
    <PageHeader
      eyebrow="Stock custody"
      title="Inventory control"
      description="Tenant users can view stock but cannot move it manually. Store approvals and order lifecycle events remain automatic."
    />
    <StockReceiptForm tenants={options} />
    <Card title="Recent own-supplier receipts" description="The latest 25 owner-recorded stock movements" flush>
      <div className="overflow-x-auto">
        <table className={saTable}>
          <thead className={saThead}><tr>
            <th className={saTh}>Date</th>
            <th className={saTh}>Tenant</th>
            <th className={saTh}>Product</th>
            <th className={`${saTh} text-right`}>Quantity</th>
            <th className={saTh}>Details</th>
            <th className={saTh}>Recorded by</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-200">
            {recent.length === 0 && <tr><td colSpan={6} className="p-0"><EmptyState title="No own-supplier receipts yet" description="Stock received directly from a tenant's own supplier will be listed here." /></td></tr>}
            {recent.map((movement) => <tr key={movement.id} className={saTr}>
              <td className={`${saTd} whitespace-nowrap text-slate-500`}>{movement.createdAt.toLocaleString('en-LK')}</td>
              <td className={`${saTd} font-semibold text-slate-900`}>{movement.tenant.businessName || movement.tenant.name}</td>
              <td className={saTd}>{movement.product.code} · {movement.product.name}</td>
              <td className={`${saTd} text-right font-bold tabular-nums text-emerald-700`}>+{movement.quantity}</td>
              <td className={`${saTd} text-slate-500`}>{movement.reason}</td>
              <td className={`${saTd} text-slate-500`}>{movement.adjustedBy.name || movement.adjustedBy.email}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </Card>
  </div>;
}
