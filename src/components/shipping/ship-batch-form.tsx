'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';

type ReadyOrder = { id: string; number: number; customerName: string; customerCity: string; customerPhone: string; quantity: number; total: number; codAmount: number | null; createdAt: Date; product: { name: string }; assignedTo: { name: string | null } | null; shippingLocationProvider: string | null; shippingCityId: number | null; trackingNumber: string | null; shippingProvider: string | null };
type ShipError = { orderId: string; number: number; error: string };
const formats = new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' });
// Small requests keep each one well inside the hosting timeout; every chunk
// joins the batch the first one created.
const CHUNK_SIZE = 3;
const couriers = [{ value: 'TRANS_EXPRESS', label: 'Trans Express · automatic booking' }, { value: 'FARDA_EXPRESS', label: 'Farda Express · enter tracking numbers' }, { value: 'SL_POST', label: 'SL Post · enter tracking numbers' }];

export function ShipBatchForm({ orders, canShip }: { orders: ReadyOrder[]; canShip: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [courier, setCourier] = useState('TRANS_EXPRESS');
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<ShipError[]>([]);
  const [failedBatchId, setFailedBatchId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState<'ALL' | 'KANDY'>('ALL');
  const shown = useMemo(() => orders.filter(order => (city === 'ALL' || order.customerCity.toLowerCase().includes('kandy')) && `${order.number} ${order.customerName} ${order.customerPhone} ${order.product.name}`.toLowerCase().includes(search.toLowerCase())), [orders, search, city]);
  const selectedOrders = orders.filter(order => selected.includes(order.id));
  const total = selectedOrders.reduce((sum, order) => sum + (order.codAmount ?? order.total), 0);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const toggleShown = () => setSelected(current => shown.every(order => current.includes(order.id)) ? current.filter(id => !shown.some(order => order.id === id)) : [...new Set([...current, ...shown.map(order => order.id)])]);
  // Orders recorded as shipped leave the queue on refresh; drop them from the selection too.
  useEffect(() => setSelected(current => current.filter(id => orders.some(order => order.id === id))), [orders]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  const ship = async () => {
    if (!selected.length) return toast.warning('Select orders to ship.');
    if (selected.length > 100) return toast.warning('Ship up to 100 orders in one batch.');
    const needsTracking = (id: string) => !orders.find(order => order.id === id)?.trackingNumber;
    if (courier !== 'TRANS_EXPRESS' && selected.some(id => needsTracking(id) && !tracking[id]?.trim())) return toast.warning('Enter tracking numbers for every selected order.');
    const queue = [...selected];
    const errors: ShipError[] = [];
    let batchId: string | undefined;
    let shipped = 0;
    let sent = 0;
    let stopped: string | null = null;
    setBusy(true);
    setFailures([]);
    setFailedBatchId(null);
    setProgress({ done: 0, total: queue.length });
    for (; sent < queue.length; sent += CHUNK_SIZE) {
      const chunk = queue.slice(sent, sent + CHUNK_SIZE);
      try {
        const response = await fetch('/api/shipping/batches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: chunk, provider: courier, trackingNumbers: Object.fromEntries(chunk.filter(id => tracking[id]?.trim()).map(id => [id, tracking[id]])), batchId }) });
        const result = await response.json().catch(() => null);
        // A chunk where nothing shipped still reports why per order; anything
        // else (timeout page, bad request) stops so nothing is sent blind.
        if (!result || (!response.ok && !Array.isArray(result.errors))) { stopped = result?.error || `The server did not respond (HTTP ${response.status}).`; break; }
        if (result.id) batchId = result.id;
        shipped += result.shippedCount || 0;
        errors.push(...(result.errors || []));
      } catch { stopped = 'The connection was lost.'; break; }
      setProgress({ done: Math.min(sent + CHUNK_SIZE, queue.length), total: queue.length });
    }
    setBusy(false);
    const failedIds = new Set(errors.map(error => error.orderId));
    // Keep what still needs attention selected: failures and anything never sent.
    setSelected(queue.filter((id, index) => failedIds.has(id) || index >= sent));
    setFailures(errors);
    if (stopped) toast.error(`Stopped after ${Math.min(sent, queue.length)} of ${queue.length} orders: ${stopped} Press Ship now to continue; booked orders will not be booked twice.`);
    if (shipped) toast.success(`${shipped} of ${queue.length} order(s) shipped.`);
    if (!stopped && !errors.length && batchId) { router.push(`/shipping?batch=${batchId}`); router.refresh(); return; }
    setFailedBatchId(batchId ?? null);
    router.refresh();
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setCity('ALL')} className={`rounded border px-4 py-2 text-sm ${city === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>All Orders</button><button type="button" onClick={() => setCity('KANDY')} className={`rounded border px-4 py-2 text-sm ${city === 'KANDY' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>Kandy Orders</button></div>
    <div className="rounded-lg border bg-card p-4"><label className="block text-sm font-semibold">Search Orders for Shipping<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Order number, customer, phone or product" className="mt-2 w-full rounded border bg-background px-3 py-2 font-normal" /></label></div>
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-sm"><strong>Selected items: {selected.length}</strong><strong>Total COD: {formats.format(total)}</strong><select value={courier} onChange={event => setCourier(event.target.value)} aria-label="Delivery company" className="rounded border bg-background px-3 py-2">{couriers.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button onClick={toggleShown} className="rounded border px-3 py-2">{shown.every(order => selected.includes(order.id)) ? 'Clear visible' : 'Select all visible'}</button><button disabled={!canShip || busy} onClick={ship} className="rounded bg-primary px-4 py-2 font-semibold text-primary-foreground disabled:opacity-50">{busy ? `Shipping ${progress.done} of ${progress.total}…` : 'Ship now'}</button></div>
    {failures.length > 0 && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"><p className="font-semibold">{failures.length} order(s) not shipped. They are still selected.{failedBatchId && <> <Link href={`/shipping/batches/${failedBatchId}`} className="text-primary hover:underline">View batch</Link></>}</p><ul className="mt-2 space-y-1">{failures.map(failure => <li key={failure.orderId}>#{failure.number}: {failure.error}</li>)}</ul></div>}
    {courier === 'TRANS_EXPRESS' && <p className="text-sm text-muted-foreground">Trans Express bookings use the city saved on each order. Orders without a saved city are reported and left unshipped.</p>}
    <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[920px] text-sm"><thead className="bg-muted/40"><tr>{['Select', 'Order', 'Created', 'Customer', 'City', 'Product', 'Qty', 'COD', 'Staff', ...(courier === 'TRANS_EXPRESS' ? ['Location'] : ['Tracking number'])].map(title => <th key={title} className="px-3 py-3 text-left">{title}</th>)}</tr></thead><tbody className="divide-y">{shown.map(order => <tr key={order.id}><td className="px-3 py-2"><input type="checkbox" checked={selected.includes(order.id)} onChange={() => toggle(order.id)} aria-label={`Select order ${order.number}`} /></td><td className="px-3 py-2"><Link href={`/orders/${order.id}`} className="font-semibold text-primary hover:underline">#{order.number}</Link></td><td className="whitespace-nowrap px-3 py-2">{new Date(order.createdAt).toLocaleDateString('en-LK')}</td><td className="px-3 py-2">{order.customerName}<span className="block text-xs text-muted-foreground">{order.customerPhone}</span></td><td className="px-3 py-2">{order.customerCity}</td><td className="px-3 py-2">{order.product.name}</td><td className="px-3 py-2">{order.quantity}</td><td className="whitespace-nowrap px-3 py-2">{formats.format(order.codAmount ?? order.total)}</td><td className="px-3 py-2">{order.assignedTo?.name || '—'}</td><td className="px-3 py-2">{order.trackingNumber ? <span title="Booked with the courier but not recorded. Ship it again to finish; it will not be booked twice." className="text-amber-700 dark:text-amber-400">Booked · {order.trackingNumber}</span> : courier === 'TRANS_EXPRESS' ? (order.shippingLocationProvider === 'TRANS_EXPRESS' && order.shippingCityId ? 'Ready' : 'Set city on order') : <input value={tracking[order.id] || ''} onChange={event => setTracking(current => ({ ...current, [order.id]: event.target.value }))} placeholder="Tracking number" aria-label={`Tracking number for order ${order.number}`} className="min-w-[170px] rounded border bg-background px-2 py-1" />}</td></tr>)}</tbody></table>{shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No orders match.</p>}</div>
  </div>;
}
