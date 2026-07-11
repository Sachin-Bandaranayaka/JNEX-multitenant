'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowPathIcon, CheckCircleIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';
import { playErrorSound, playSuccessSound } from '@/lib/sounds';

interface OrderMatch {
  id: string; number: number; trackingNumber: string; customerName: string; customerPhone: string;
  customerCity: string; quantity: number; total: number; status: string;
  product: { name: string; code: string; price: number };
}

export default function AddReturnPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [waybill, setWaybill] = useState('');
  const [match, setMatch] = useState<OrderMatch | null>(null);
  const [recent, setRecent] = useState<OrderMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const reset = () => { setWaybill(''); setMatch(null); requestAnimationFrame(() => inputRef.current?.focus()); };
  const lookup = async () => {
    if (!waybill.trim()) return toast.error('Enter a waybill number');
    setLoading(true); setMatch(null);
    try {
      const res = await fetch(`/api/returns/waybill?waybill=${encodeURIComponent(waybill.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Waybill not found');
      setMatch(data);
    } catch (error) { playErrorSound(); toast.error(error instanceof Error ? error.message : 'Lookup failed'); }
    finally { setLoading(false); }
  };
  const confirmReturn = async () => {
    if (!match) return;
    setLoading(true);
    try {
      const res = await fetch('/api/returns/waybill', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ waybill: match.trackingNumber }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Return failed');
      setRecent(prev => [{ ...match, status: 'RETURNED' }, ...prev]); playSuccessSound(); toast.success(`Order #${match.number} added to returns`); reset();
    } catch (error) { playErrorSound(); toast.error(error instanceof Error ? error.message : 'Return failed'); }
    finally { setLoading(false); }
  };

  return <div className="mx-auto max-w-5xl space-y-5">
    <header><h1 className="text-2xl font-bold text-slate-800">Add Return</h1><p className="mt-1 text-sm text-slate-500">Scan or type a waybill, verify the order, then confirm the return.</p></header>
    <section className="genzo-card">
      <label htmlFor="waybill" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Waybill ID</label>
      <div className="flex gap-2">
        <input ref={inputRef} autoFocus id="waybill" value={waybill} onChange={e => { setWaybill(e.target.value); setMatch(null); }} onKeyDown={e => e.key === 'Enter' && lookup()} placeholder="Scan or enter waybill number" className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 font-mono text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200" />
        <button onClick={lookup} disabled={loading || !waybill.trim()} className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-800 px-5 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">{loading ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <MagnifyingGlassIcon className="h-4 w-4" />} Find order</button>
      </div>
    </section>

    {match && <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-teal-50 px-5 py-3"><div><div className="text-xs font-bold uppercase tracking-wide text-teal-700">Order matched — verify details</div><div className="mt-0.5 text-sm text-teal-800">Nothing changes until you confirm below.</div></div><button onClick={reset} aria-label="Clear match"><XMarkIcon className="h-5 w-5 text-slate-500" /></button></div>
      <dl className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
        {[['Order', `#${match.number}`], ['Customer', `${match.customerName} · ${match.customerPhone}`], ['Location', match.customerCity || '—'], ['Product', `${match.product.name} (${match.product.code}) × ${match.quantity}`], ['Waybill', match.trackingNumber], ['Amount', `Rs. ${match.total.toLocaleString()}`]].map(([label,value]) => <div key={label} className="bg-white px-5 py-4"><dt className="text-xs font-semibold text-slate-500">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd></div>)}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4"><div><OrderStatusBadge status={match.status as any} />{!['SHIPPED','DELIVERED'].includes(match.status) && <p className="mt-2 text-xs font-semibold text-red-600">Only shipped or delivered orders can be returned.</p>}</div><div className="flex gap-2"><button onClick={reset} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button><button onClick={confirmReturn} disabled={loading || !['SHIPPED','DELIVERED'].includes(match.status)} className="inline-flex h-10 items-center gap-2 rounded-md bg-red-600 px-5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"><CheckCircleIcon className="h-4 w-4" /> Confirm Add Return</button></div></div>
    </section>}

    <section className="border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-bold text-slate-700">Returns added this session</h2><span className="text-xs text-slate-500">{recent.length} processed</span></div>{recent.length ? <div className="divide-y divide-slate-200">{recent.map(o => <Link key={o.id} href={`/orders/${o.id}`} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 hover:bg-slate-50"><div><div className="text-sm font-bold text-slate-800">Order #{o.number} · {o.customerName}</div><div className="text-xs text-slate-500">{o.trackingNumber} · {o.product.name}</div></div><span className="text-xs font-bold text-red-600">RETURNED</span></Link>)}</div> : <div className="px-4 py-8 text-center text-sm text-slate-500">Confirmed returns will appear here.</div>}</section>
  </div>;
}
