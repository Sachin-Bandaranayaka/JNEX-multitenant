'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

type ReadyOrder = { id: string; number: number; customerName: string; customerCity: string; customerPhone: string; quantity: number; total: number; codAmount: number | null; createdAt: Date; product: { name: string }; assignedTo: { name: string | null } | null; shippingLocationProvider: string | null; shippingCityId: number | null };
const formats = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });
const couriers = [{ value: 'TRANS_EXPRESS', label: 'Trans Express · automatic booking' }, { value: 'FARDA_EXPRESS', label: 'Farda Express · enter tracking numbers' }, { value: 'SL_POST', label: 'SL Post · enter tracking numbers' }];

export function ShipBatchForm({ orders, canShip }: { orders: ReadyOrder[]; canShip: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [courier, setCourier] = useState('TRANS_EXPRESS');
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState<'ALL' | 'KANDY'>('ALL');
  const shown = useMemo(() => orders.filter(order => (city === 'ALL' || order.customerCity.toLowerCase().includes('kandy')) && `${order.number} ${order.customerName} ${order.customerPhone} ${order.product.name}`.toLowerCase().includes(search.toLowerCase())), [orders, search, city]);
  const selectedOrders = orders.filter(order => selected.includes(order.id));
  const total = selectedOrders.reduce((sum, order) => sum + (order.codAmount ?? order.total), 0);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleShown = () => setSelected(current => shown.every(order => current.includes(order.id)) ? current.filter(id => !shown.some(order => order.id === id)) : [...new Set([...current, ...shown.map(order => order.id)])]);
  const ship = async () => {
    if (!selected.length) return toast.warning('Select orders to ship.');
    if (selected.length > 100) return toast.warning('Ship up to 100 orders in one batch.');
    if (courier !== 'TRANS_EXPRESS' && selected.some(id => !tracking[id]?.trim())) return toast.warning('Enter tracking numbers for every selected order.');
    setBusy(true);
    try {
      const response = await fetch('/api/shipping/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: selected, provider: courier, trackingNumbers: tracking }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not ship selected orders.');
      toast.success(`${result.shippedCount} order(s) shipped in batch ${result.id}.`);
      for (const error of result.errors || []) toast.error(`Order #${error.number}: ${error.error}`);
      router.push(`/shipping?batch=${result.id}`);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Shipment failed.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setCity('ALL')} className={`rounded border px-4 py-2 text-sm ${city === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>All Orders</button><button type="button" onClick={() => setCity('KANDY')} className={`rounded border px-4 py-2 text-sm ${city === 'KANDY' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>Kandy Orders</button></div>
    <div className="rounded-lg border bg-card p-4"><label className="block text-sm font-semibold">Search Orders for Shipping<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Order number, customer, phone or product" className="mt-2 w-full rounded border bg-background px-3 py-2 font-normal" /></label></div>
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-sm"><strong>Selected items: {selected.length}</strong><strong>Total COD: {formats.format(total)}</strong><select value={courier} onChange={event => setCourier(event.target.value)} aria-label="Delivery company" className="rounded border bg-background px-3 py-2">{couriers.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button onClick={toggleShown} className="rounded border px-3 py-2">{shown.every(order => selected.includes(order.id)) ? 'Clear visible' : 'Select all visible'}</button><button disabled={!canShip || busy} onClick={ship} className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{busy ? 'Shipping…' : 'Ship now'}</button></div>
    {courier === 'TRANS_EXPRESS' && <p className="text-sm text-muted-foreground">Trans Express bookings use the city saved on each order. Orders without a saved city are reported and left unshipped.</p>}
    <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[920px] text-sm"><thead className="bg-muted/40"><tr>{['Select', 'Order', 'Created', 'Customer', 'City', 'Product', 'Qty', 'COD', 'Staff', ...(courier === 'TRANS_EXPRESS' ? ['Location'] : ['Tracking number'])].map(title => <th key={title} className="px-3 py-3 text-left">{title}</th>)}</tr></thead><tbody className="divide-y">{shown.map(order => <tr key={order.id}><td className="px-3 py-2"><input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggle(order.id)} aria-label={`Select order ${order.number}`} /></td><td className="px-3 py-2"><Link href={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">#{order.number}</Link></td><td className="whitespace-nowrap px-3 py-2">{new Date(order.createdAt).toLocaleDateString('en-LK')}</td><td className="px-3 py-2">{order.customerName}<span className="block text-xs text-muted-foreground">{order.customerPhone}</span></td><td className="px-3 py-2">{order.customerCity}</td><td className="px-3 py-2">{order.product.name}</td><td className="px-3 py-2">{order.quantity}</td><td className="whitespace-nowrap px-3 py-2">{formats.format(order.codAmount ?? order.total)}</td><td className="px-3 py-2">{order.assignedTo?.name || '—'}</td><td className="px-3 py-2">{courier === 'TRANS_EXPRESS' ? (order.shippingLocationProvider === 'TRANS_EXPRESS' && order.shippingCityId ? 'Ready' : 'Set city on order') : <input value={tracking[order.id] || ''} onChange={event => setTracking(current => ({ ...current, [order.id]: event.target.value }))} placeholder="Tracking number" aria-label={`Tracking number for order ${order.number}`} className="min-w-[170px] rounded border bg-background px-2 py-1" />}</td></tr>)}</tbody></table>{shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No orders match.</p>}</div>
  </div>;
}
