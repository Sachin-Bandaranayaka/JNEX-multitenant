import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/authz';
import { can } from '@/lib/permissions';
import { getScopedPrismaClient } from '@/lib/prisma';
import { shippingWhere, summarizeShipments, normalizeShippingFilters, ShippingSection, ShippingFilters } from '@/lib/shipping-workspace';
import { statusLabel } from '@/lib/order-presentation';
import { ShippingList } from './shipping-list';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
const sections = {
    ship: { title: 'Ship', path: '/shipping/ship', detail: 'Review pending orders and arrange their shipment.' },
    shipped: { title: 'Shipped List', path: '/shipping', detail: 'Review shipment records and print invoices for selected orders.' },
    summary: { title: 'Shipped Summary', path: '/shipping/summary', detail: 'Compare shipment volume and delivery outcomes by courier.' },
    delivery: { title: 'Delivery', path: '/shipping/delivery', detail: 'Follow delivery outcomes and recorded shipment dates.' },
};
const control = 'mt-1 block w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
const cell = 'px-4 py-3 text-left text-sm text-foreground';
const dateFormat = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });
const money = (value: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(value);

export async function ShippingWorkspacePage({ section, searchParams }: { section: ShippingSection; searchParams: Promise<ShippingFilters> }) {
    const guard = await requirePermission('VIEW_SHIPPING');
    if (!guard.ok) redirect('/unauthorized');
    const filters = normalizeShippingFilters(section, await searchParams);
    const prisma = getScopedPrismaClient(guard.tenantId);
    const [orders, staff] = await Promise.all([
        prisma.order.findMany({ where: shippingWhere(guard.tenantId, section, filters), include: { product: true, assignedTo: true }, orderBy: section === 'ship' ? { createdAt: 'desc' } : { shippedAt: 'desc' } }),
        prisma.user.findMany({ where: { tenantId: guard.tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    const config = sections[section];
    const canViewOrders = can(guard.session.user, 'VIEW_ORDERS');
    const canShip = can(guard.session.user, 'UPDATE_SHIPPING_STATUS');
    const statuses = section === 'ship' ? ['PENDING', 'CONFIRMED'] : ['SHIPPED', 'DELIVERED', 'RETURNED', 'RESCHEDULED', ...(section === 'delivery' ? [] : ['CANCELLED'])];
    const groups = summarizeShipments(orders);
    return <div className="min-w-0 space-y-5">
        <header><h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{config.title}</h1><p className="mt-1 text-sm text-muted-foreground">{config.detail}</p></header>
        <form action={config.path} method="get" className="rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="min-w-0 text-xs font-medium text-muted-foreground">Search orders<input name="q" defaultValue={filters.q || ''} placeholder="Order number, name or phone" className={control} /></label>
                <label className="min-w-0 text-xs font-medium text-muted-foreground">Courier<select name="courier" defaultValue={filters.courier || ''} className={control}><option value="">All couriers</option>{['TRANS_EXPRESS', 'FARDA_EXPRESS', 'SL_POST', ...(section !== 'ship' ? ['ROYAL_EXPRESS'] : [])].map(courier => <option key={courier} value={courier}>{statusLabel(courier)}{courier === 'ROYAL_EXPRESS' ? ' (historical)' : ''}</option>)}</select></label>
                <label className="min-w-0 text-xs font-medium text-muted-foreground">Assigned staff<select name="staff" defaultValue={filters.staff || ''} className={control}><option value="">All staff</option>{staff.map(person => <option key={person.id} value={person.id}>{person.name || 'Unnamed staff member'}</option>)}</select></label>
                <label className="min-w-0 text-xs font-medium text-muted-foreground">Status<select name="status" defaultValue={filters.status || ''} className={control}><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
                <label className="min-w-0 text-xs font-medium text-muted-foreground">{section === 'ship' ? 'Created' : 'Shipped'} from<input type="date" name="from" defaultValue={filters.from || ''} className={control} /></label>
                <label className="min-w-0 text-xs font-medium text-muted-foreground">{section === 'ship' ? 'Created' : 'Shipped'} to<input type="date" name="to" defaultValue={filters.to || ''} className={control} /></label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                {section !== 'ship' && <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" name="view" value="exceptions" defaultChecked={filters.view === 'exceptions'} className="rounded border-border text-primary focus:ring-primary" />Recorded courier exceptions</label>}
                <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Apply filters</button><Link href={config.path} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted">Clear</Link>
                <p className="text-xs text-muted-foreground">Dates use Sri Lanka time.</p>
            </div>
        </form>
        <p className="text-sm text-muted-foreground">{orders.length.toLocaleString()} matching {orders.length === 1 ? 'order' : 'orders'}</p>
        {section === 'shipped' || section === 'delivery' ? <ShippingList key={JSON.stringify(filters)} orders={orders} serverFiltered canViewOrders={canViewOrders} canPrint={can(guard.session.user, 'CREATE_ORDERS') || can(guard.session.user, 'EDIT_ORDERS')} /> : orders.length === 0 ? <div className="rounded-xl border border-border bg-card px-6 py-12 text-center"><h2 className="font-semibold text-foreground">No matching orders</h2><p className="mt-2 text-sm text-muted-foreground">Adjust or clear the filters to see more orders.</p></div> : section === 'ship' ? <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[780px] border-collapse"><caption className="sr-only">Orders ready for shipment review</caption><thead className="bg-muted/40"><tr>{['Order', 'Customer', 'Product / quantity', 'Status', 'Assigned staff', 'Created', 'Action'].map(label => <th key={label} className={`${cell} font-semibold`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{orders.map(order => <tr key={order.id}><td className={cell}>{canViewOrders ? <Link className="font-semibold text-primary hover:underline" href={`/orders/${order.id}`}>#{order.number}</Link> : <span className="font-semibold">#{order.number}</span>}</td><td className={cell}>{order.customerName}<span className="mt-1 block text-xs text-muted-foreground">{order.customerPhone}</span></td><td className={cell}>{order.product.name}<span className="mt-1 block text-xs text-muted-foreground">Quantity: {order.quantity}</span></td><td className={cell}><OrderStatusBadge status={order.status} /></td><td className={cell}>{order.assignedTo?.name || 'Not assigned'}</td><td className={`${cell} whitespace-nowrap`}>{dateFormat.format(order.createdAt)}</td><td className={cell}>{canViewOrders ? <Link href={`/orders/${order.id}`} className="whitespace-nowrap text-primary hover:underline">{canShip ? 'Review & ship' : 'Review order'}</Link> : <span className="text-muted-foreground">No order access</span>}</td></tr>)}</tbody></table></div> : <section className="space-y-3">
            <p className="text-sm text-muted-foreground">Saved order value reflects the matching order records. It does not represent collected COD. Other includes cancelled orders and any remaining recorded statuses.</p>
            <div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full min-w-[760px] border-collapse"><caption className="sr-only">Shipment totals by courier for the current filters</caption><thead className="bg-muted/40"><tr>{['Courier', 'Orders', 'Units', 'Saved order value', 'Delivered', 'Returned', 'In progress', 'Other'].map(label => <th key={label} className={`${cell} font-semibold`}>{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{groups.map(group => <tr key={group.courier}><td className={cell}>{statusLabel(group.courier)}{group.courier === 'ROYAL_EXPRESS' && <span className="block text-xs text-muted-foreground">Historical</span>}</td><td className={cell}>{group.orders}</td><td className={cell}>{group.quantity}</td><td className={`${cell} whitespace-nowrap tabular-nums`}>{money(group.total)}</td><td className={cell}>{group.delivered}</td><td className={cell}>{group.returned}</td><td className={cell}>{group.inProgress}</td><td className={cell}>{group.other}</td></tr>)}</tbody><tfoot className="border-t border-border bg-muted/40"><tr><th className={cell}>Filtered total</th><td className={cell}>{orders.length}</td><td className={cell}>{groups.reduce((sum, group) => sum + group.quantity, 0)}</td><td className={`${cell} whitespace-nowrap font-semibold`}>{money(groups.reduce((sum, group) => sum + group.total, 0))}</td><td className={cell}>{groups.reduce((sum, group) => sum + group.delivered, 0)}</td><td className={cell}>{groups.reduce((sum, group) => sum + group.returned, 0)}</td><td className={cell}>{groups.reduce((sum, group) => sum + group.inProgress, 0)}</td><td className={cell}>{groups.reduce((sum, group) => sum + group.other, 0)}</td></tr></tfoot></table></div>
        </section>}
    </div>;
}
