'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { DataExport } from '@/components/leads/data-export';
import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface ReturnedOrder {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  trackingNumber: string | null;
  shippingProvider: string | null;
  userId: string;
  quantity: number;
  total: number;
  updatedAt: string;
  product: { name: string; price: number; code: string };
  assignedTo: { name: string | null } | null;
}

export function ReturnedListClient({ orders }: { orders: ReturnedOrder[] }) {
  const [search, setSearch] = useState('');

  const [courier,setCourier] = useState(''); const [staff,setStaff] = useState(''); const [fromDate,setFromDate] = useState(''); const [toDate,setToDate] = useState('');
  const filtered = orders.filter(order => {
    const query = search.trim().toLowerCase();
    return (!query || `${order.number} ${order.customerName} ${order.customerPhone} ${order.trackingNumber || ''} ${order.product.name}`.toLowerCase().includes(query)) && (!courier || order.shippingProvider === courier) && (!staff || order.userId === staff) && (!fromDate || new Date(order.updatedAt).getTime() >= new Date(`${fromDate}T00:00:00+05:30`).getTime()) && (!toDate || new Date(order.updatedAt).getTime() < new Date(`${toDate}T00:00:00+05:30`).getTime()+86400000);
  });

  const exportColumns = [
    { key: 'number', label: '#' },
    { key: 'customer', label: 'Customer Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'product', label: 'Product' },
    { key: 'tracking', label: 'Tracking No' },
    { key: 'price', label: 'Price' },
    { key: 'qty', label: 'Qty' },
    { key: 'date', label: 'Last Updated' },
  ];
  const exportData = filtered.map((o) => ({
    number: o.number,
    customer: o.customerName,
    phone: o.customerPhone,
    product: o.product.name,
    tracking: o.trackingNumber || 'N/A',
    price: o.product.price.toFixed(2),
    qty: o.quantity,
    date: format(new Date(o.updatedAt), 'yyyy-MM-dd'),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Returned List</h1>
        <p className="text-sm text-muted-foreground">All orders that have been returned</p>
      </div>

      <section aria-label="Return filters" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground">Courier<select value={courier} onChange={e=>setCourier(e.target.value)} className="mt-1 block rounded-md border-border bg-background text-sm"><option value="">All couriers</option>{[...new Set(orders.map(order=>order.shippingProvider).filter(Boolean))].map(value=><option key={value} value={value!}>{value!.replace(/_/g,' ')}{value==='ROYAL_EXPRESS'?' (historical)':''}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Staff<select value={staff} onChange={e=>setStaff(e.target.value)} className="mt-1 block rounded-md border-border bg-background text-sm"><option value="">All staff</option>{[...new Map(orders.map(order=>[order.userId,order.assignedTo?.name])).entries()].map(([id,name])=><option key={id} value={id}>{name || 'Unnamed staff'}</option>)}</select></label>
        <label className="text-xs text-muted-foreground">Last updated from<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="mt-1 block rounded-md border-border bg-background text-sm" /></label><label className="text-xs text-muted-foreground">Last updated to<input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="mt-1 block rounded-md border-border bg-background text-sm" /></label>
        <button onClick={()=>{setSearch('');setCourier('');setStaff('');setFromDate('');setToDate('');}} className="rounded-md border border-border px-3 py-2 text-sm text-foreground">Clear filters</button><p className="text-xs text-muted-foreground">Returned orders only · Sri Lanka dates</p>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing {filtered.length} of {orders.length} entries
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" aria-label="Search returned orders" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 w-48 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
          </div>
          <DataExport data={exportData} columns={exportColumns} filename="returned_orders" />
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#e6e9ed] bg-white dark:border-border dark:bg-card">
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">#</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Order ID</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Customer</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Products</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Tracking No</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Price (Rs)</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Qty</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px] hidden md:table-cell">Staff</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px] hidden lg:table-cell">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No returned orders found</td></tr>
              ) : (
                filtered.map((order, idx) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/orders/${order.id}`} className="text-primary hover:underline font-medium">
                        {order.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{order.customerName}</td>
                    <td className="px-4 py-2.5 text-foreground">{order.product.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-primary font-medium">{order.trackingNumber || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{order.product.price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-foreground">{order.quantity}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{order.assignedTo?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell text-xs">{format(new Date(order.updatedAt), 'yyyy-MM-dd')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
