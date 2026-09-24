import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/authz';
import { can } from '@/lib/permissions';
import { getScopedPrismaClient } from '@/lib/prisma';
import { shippingWhere, type ShippingFilters } from '@/lib/shipping-workspace';
import { ShipBatchForm } from '@/components/shipping/ship-batch-form';

export default async function Page({ searchParams }: { searchParams: Promise<ShippingFilters> }) {
  const guard = await requirePermission('VIEW_SHIPPING');
  if (!guard.ok) redirect('/unauthorized');
  const filters = await searchParams;
  const prisma = getScopedPrismaClient(guard.tenantId);
  const [orders, staff] = await Promise.all([
    prisma.order.findMany({ where: shippingWhere(guard.tenantId, 'ship', filters), include: { product: { select: { name: true } }, assignedTo: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 500 }),
    prisma.user.findMany({ where: { tenantId: guard.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return <div className="space-y-5"><header><h1 className="text-2xl font-bold">Ship</h1><p className="text-sm text-muted-foreground">Select ready orders, choose a courier, and create a shipment batch.</p></header>
    <form action="/shipping/ship" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4 text-sm">
      <label>Assigned staff<select name="staff" defaultValue={filters.staff || ''} className="mt-1 block rounded border bg-background px-3 py-2"><option value="">All staff</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
      <label>Created from<input type="date" name="from" defaultValue={filters.from || ''} className="mt-1 block rounded border bg-background px-3 py-2" /></label>
      <label>Created to<input type="date" name="to" defaultValue={filters.to || ''} className="mt-1 block rounded border bg-background px-3 py-2" /></label>
      <label>Status<select name="status" defaultValue={filters.status || ''} className="mt-1 block rounded border bg-background px-3 py-2"><option value="">All ready</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option></select></label>
      <button className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground">Search</button>
    </form>
    <ShipBatchForm orders={orders} canShip={can(guard.session.user, 'UPDATE_SHIPPING_STATUS') || can(guard.session.user, 'EDIT_ORDERS')} />
  </div>;
}
