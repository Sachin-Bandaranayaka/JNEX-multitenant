export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { ArrowRightIcon, BuildingOffice2Icon, CubeIcon, BanknotesIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default async function SuperAdminDashboardPage() {
  const [activeTenants, inactiveTenants, products, ordersByStatus, recentTenants] = await Promise.all([
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.tenant.count({ where: { isActive: false } }),
    prisma.product.findMany({ select: { stock: true, lowStockAlert: true } }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.tenant.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, name: true, isActive: true, updatedAt: true, _count: { select: { products: true, orders: true } } } }),
  ]);
  const orderCount = (status: string) => ordersByStatus.find((row) => row.status === status)?._count._all || 0;
  const totalOrders = ordersByStatus.reduce((sum, row) => sum + row._count._all, 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.lowStockAlert).length;
  const outOfStock = products.filter((p) => p.stock <= 0).length;

  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 border-b border-slate-300 pb-6 sm:flex-row sm:items-end">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e10600]">Operations overview</p><h1 className="mt-1 text-2xl font-bold tracking-tight">Owner command desk</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Monitor tenant health, stock exposure, orders, and platform controls from one place.</p></div>
      <Link href="/superadmin/users" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#e10600] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#ba0500] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">Inspect tenants <ArrowRightIcon className="h-4 w-4" /></Link>
    </div>

    <section aria-labelledby="tenant-health"><div className="mb-3 flex items-center justify-between"><h2 id="tenant-health" className="text-sm font-bold uppercase tracking-wider text-slate-700">Tenant health</h2><span className="text-xs text-slate-500">{activeTenants + inactiveTenants} total accounts</span></div>
      <div className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"><div className="grid divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[['Total tenants', activeTenants + inactiveTenants, 'text-slate-900'], ['Active', activeTenants, 'text-emerald-700'], ['Inactive', inactiveTenants, 'text-red-700']].map(([label, value, color]) => <div key={String(label)} className="p-5"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-2 text-3xl font-bold tabular-nums ${color}`}>{value}</p></div>)}
      </div></div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
      <section className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">Operational position</h2><p className="mt-1 text-xs text-slate-500">Platform-wide live totals</p></div><div className="grid grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4">
        {[['Products', products.length, ''], ['Low stock', lowStock, 'text-amber-700'], ['Out of stock', outOfStock, 'text-red-700'], ['All orders', totalOrders, '']].map(([label, value, color]) => <div key={String(label)} className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{value}</p></div>)}
        {[['Delivered', orderCount('DELIVERED'), 'text-emerald-700'], ['Returned', orderCount('RETURNED'), 'text-amber-700'], ['Pending', orderCount('PENDING'), ''], ['Shipped', orderCount('SHIPPED'), '']].map(([label, value, color]) => <div key={String(label)} className="p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{value}</p></div>)}
      </div></section>
      <section className="rounded-md border border-slate-300 bg-[#22252a] p-5 text-white shadow-sm"><div className="flex items-center gap-3"><ShieldCheckIcon className="h-7 w-7 text-amber-400" /><div><h2 className="font-bold">Controlled tenant access</h2><p className="text-xs text-slate-400">Password-safe and fully audited</p></div></div><p className="mt-5 text-sm leading-6 text-slate-300">Inspect a tenant first, then cross a re-authentication checkpoint for a 15-minute read-only view.</p><Link href="/superadmin/audit" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-amber-300 hover:text-amber-200">Review custody history <ArrowRightIcon className="h-4 w-4" /></Link></section>
    </div>

    <section className="rounded-md border border-slate-300 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="font-bold">Recently updated tenants</h2><p className="mt-1 text-xs text-slate-500">Quick access to active operations</p></div><Link href="/superadmin/users" className="text-sm font-bold text-[#c50500] hover:underline">View all</Link></div>
      {recentTenants.length ? <div className="divide-y divide-slate-200">{recentTenants.map((tenant) => <Link href={`/superadmin/tenants/${tenant.id}`} key={tenant.id} className="grid gap-2 px-5 py-4 transition-colors hover:bg-slate-50 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><span className="font-semibold">{tenant.name}</span><span className={`w-fit rounded px-2 py-1 text-[11px] font-bold ${tenant.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{tenant.isActive ? 'Active' : 'Inactive'}</span><span className="text-xs text-slate-500">{tenant._count.products} products · {tenant._count.orders} orders</span><ArrowRightIcon className="h-4 w-4 text-slate-400" /></Link>)}</div> : <div className="px-5 py-12 text-center text-sm text-slate-500">No tenants have been created yet.</div>}
    </section>
    <div className="grid gap-3 sm:grid-cols-3"><Link href="/superadmin/inventory" className="flex items-center gap-3 rounded-md border border-slate-300 bg-white p-4 font-bold hover:border-slate-500"><CubeIcon className="h-5 w-5 text-[#e10600]" />Inventory control</Link><Link href="/superadmin/billing" className="flex items-center gap-3 rounded-md border border-slate-300 bg-white p-4 font-bold hover:border-slate-500"><BanknotesIcon className="h-5 w-5 text-[#e10600]" />Billing desk</Link><Link href="/superadmin/users" className="flex items-center gap-3 rounded-md border border-slate-300 bg-white p-4 font-bold hover:border-slate-500"><BuildingOffice2Icon className="h-5 w-5 text-[#e10600]" />Tenant directory</Link></div>
  </div>;
}
