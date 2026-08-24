export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { StockReceiptForm } from './stock-receipt-form';

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
    <div>
      <h1 className="text-2xl font-bold text-white">Inventory Control</h1>
      <p className="mt-2 text-sm text-gray-300">Tenant users can view stock but cannot move it manually. Store approvals and order lifecycle events remain automatic.</p>
    </div>
    <StockReceiptForm tenants={options} />
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-white">Recent own-supplier receipts</h2>
      <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-gray-800/80 text-left text-xs uppercase text-gray-400"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Quantity</th><th className="px-4 py-3">Details</th><th className="px-4 py-3">Recorded by</th></tr></thead>
          <tbody className="divide-y divide-white/5 bg-gray-900/40">
            {recent.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">No own-supplier receipts recorded yet.</td></tr>}
            {recent.map((movement) => <tr key={movement.id}>
              <td className="px-4 py-3 text-gray-400">{movement.createdAt.toLocaleString('en-LK')}</td>
              <td className="px-4 py-3 text-white">{movement.tenant.businessName || movement.tenant.name}</td>
              <td className="px-4 py-3 text-gray-300">{movement.product.code} · {movement.product.name}</td>
              <td className="px-4 py-3 text-right font-semibold text-green-400">+{movement.quantity}</td>
              <td className="px-4 py-3 text-gray-400">{movement.reason}</td>
              <td className="px-4 py-3 text-gray-400">{movement.adjustedBy.name || movement.adjustedBy.email}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
