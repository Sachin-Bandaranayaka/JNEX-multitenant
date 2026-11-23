export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ArrowRightIcon, CheckCircleIcon, PlusIcon } from '@heroicons/react/24/outline';
import { attentionSummary } from './attention';
import { Badge, Card, EmptyState, PageHeader, Stat, saBtnPrimary, tenantLabel } from './ui';

function plural(count: number, word: string, many = `${word}s`) {
  return `${count.toLocaleString()} ${count === 1 ? word : many}`;
}

export default async function SuperAdminHomePage() {
  const [attention, activeTenants, inactiveTenants, products, recentTenants] = await Promise.all([
    attentionSummary(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.tenant.count({ where: { isActive: false } }),
    prisma.product.findMany({ where: { isActive: true }, select: { stock: true, lowStockAlert: true } }),
    prisma.tenant.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, name: true, businessName: true, isActive: true, _count: { select: { orders: true } } } }),
  ]);
  const lowOrOutOfStock = products.filter((p) => p.stock <= p.lowStockAlert).length;

  // Each row is one kind of work, in the order it should be done. A row with
  // nothing waiting is hidden, so an empty list means there is nothing to do.
  const todo = [
    { count: attention.topUps, title: `Approve ${plural(attention.topUps, 'credit top-up')}`, hint: 'Tenants paid by bank transfer and are waiting for their credits.', href: '/superadmin/billing' },
    { count: attention.invoicePayments, title: `Confirm ${plural(attention.invoicePayments, 'invoice payment')}`, hint: 'Tenants say they paid an invoice — check the bank and confirm.', href: '/superadmin/billing' },
    { count: attention.stockRequests, title: `Review ${plural(attention.stockRequests, 'stock request')}`, hint: 'Tenant staff asked to correct stock or write off waste.', href: '/superadmin/inventory/requests' },
    { count: attention.storePurchases, title: `Process ${plural(attention.storePurchases, 'store order')}`, hint: 'Tenants ordered products from the platform store.', href: '/superadmin/store/purchases' },
    { count: attention.unbilledDeliveries, title: `${plural(attention.unbilledDeliveries, 'delivery', 'deliveries')} not charged`, hint: 'These tenants have no fee rate set. Set one so future deliveries are charged.', href: '/superadmin/billing' },
  ].filter((item) => item.count > 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Home" description="What needs your attention today, and a quick look at the platform.">
        <Link href="/superadmin/create" className={saBtnPrimary}><PlusIcon className="h-4 w-4" />New tenant</Link>
      </PageHeader>

      <Card title="Needs your attention" flush>
        {todo.length ? (
          <ul className="divide-y divide-slate-200">
            {todo.map((item) => (
              <li key={item.title}>
                <Link href={item.href} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-slate-50">
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-red-50 px-2 text-sm font-bold tabular-nums text-red-700">{item.count}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-slate-900">{item.title}</span>
                    <span className="block text-sm text-slate-500">{item.hint}</span>
                  </span>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-slate-400" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 px-5 py-8 text-slate-700">
            <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
            <p className="font-semibold">All caught up — nothing is waiting on you.</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Active tenants" value={activeTenants} hint={inactiveTenants ? `${inactiveTenants} switched off` : undefined} />
        <Stat label="Unpaid invoices" value={attention.unpaidInvoices} tone={attention.unpaidInvoices ? 'warn' : 'default'} />
        <Stat label="Products low or out of stock" value={lowOrOutOfStock} tone={lowOrOutOfStock ? 'warn' : 'default'} />
      </div>

      <Card title="Recently active tenants" actions={<Link href="/superadmin/users" className="text-sm font-bold text-[#c50500] hover:underline">See all tenants</Link>} flush>
        {recentTenants.length ? (
          <div className="divide-y divide-slate-200">
            {recentTenants.map((tenant) => (
              <Link href={`/superadmin/tenants/${tenant.id}`} key={tenant.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50">
                <span className="min-w-0 flex-1 truncate font-semibold">{tenantLabel(tenant)}</span>
                {!tenant.isActive && <Badge tone="red">Off</Badge>}
                <span className="hidden text-xs text-slate-500 sm:inline">{plural(tenant._count.orders, 'order')}</span>
                <ArrowRightIcon className="h-4 w-4 text-slate-400" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No tenants yet" description="Create your first tenant to get started." />
        )}
      </Card>
    </div>
  );
}
