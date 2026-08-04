'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export interface RecentConfirmedOrder {
  id: string;
  number: number;
  customerName: string;
  productName: string;
  total: number;
  confirmedAt: string;
}

export function RecentConfirmedOrders({ orders, totalCount }: { orders: RecentConfirmedOrder[]; totalCount: number }) {
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders
      .filter((order) => !normalized || `${order.number} ${order.customerName} ${order.productName}`.toLowerCase().includes(normalized))
      .slice(0, pageSize);
  }, [orders, pageSize, query]);

  return (
    <section className="border border-border border-t-[3px] border-t-primary bg-card">
      <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5 dark:bg-slate-900/40">
        <div>
          <h2 className="text-base font-semibold text-foreground">Pending Orders</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{totalCount} confirmed today, ready for fulfillment</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Show
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-9 border border-input bg-background px-2 text-sm text-foreground focus:border-primary focus:ring-primary">
              {[5, 10, 25, 100].map((size) => <option key={size}>{size}</option>)}
            </select>
            entries
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search pending orders" placeholder="Search orders" className="h-9 w-full border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary sm:w-56" />
          </div>
          <Link href="/orders?status=CONFIRMED" className="inline-flex h-9 items-center justify-center gap-2 bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Open queue <ArrowRightIcon className="h-4 w-4" /></Link>
        </div>
      </div>
      {visible.length ? (
        <>
        <div className="divide-y divide-border sm:hidden">
          {visible.map((order) => (
            <article key={order.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">Order #{order.number}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{order.customerName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{order.productName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-foreground">Rs. {order.total.toLocaleString('en-LK')}</p>
                  <time className="mt-1 block text-xs text-muted-foreground">{new Date(order.confirmedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-2.5">Order</th><th className="px-4 py-2.5">Customer</th><th className="px-4 py-2.5">Product</th><th className="px-4 py-2.5 text-right">Total</th><th className="px-4 py-2.5 text-right">Confirmed</th></tr></thead>
            <tbody className="divide-y divide-border">{visible.map((order) => <tr key={order.id} className="hover:bg-muted/20"><td className="px-4 py-3 font-semibold">#{order.number}</td><td className="px-4 py-3">{order.customerName}</td><td className="px-4 py-3 text-muted-foreground">{order.productName}</td><td className="px-4 py-3 text-right font-medium">Rs. {order.total.toLocaleString('en-LK')}</td><td className="px-4 py-3 text-right text-muted-foreground">{new Date(order.confirmedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}</td></tr>)}</tbody>
          </table>
        </div>
        </>
      ) : <p className="px-5 py-8 text-center text-sm font-medium text-muted-foreground">{orders.length ? 'No matching orders' : 'Confirmed orders will appear here while you process leads.'}</p>}
    </section>
  );
}
