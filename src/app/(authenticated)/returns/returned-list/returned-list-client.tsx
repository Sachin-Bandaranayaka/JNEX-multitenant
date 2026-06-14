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
  quantity: number;
  total: number;
  updatedAt: string;
  product: { name: string; price: number; code: string };
  assignedTo: { name: string | null } | null;
}

export function ReturnedListClient({ orders }: { orders: ReturnedOrder[] }) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? orders.filter((o) => {
        const s = search.toLowerCase();
        return o.customerName.toLowerCase().includes(s) ||
          o.customerPhone.includes(s) ||
          (o.trackingNumber || '').includes(s) ||
          o.product.name.toLowerCase().includes(s);
      })
    : orders;

  const exportColumns = [
    { key: 'number', label: '#' },
    { key: 'customer', label: 'Customer Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'product', label: 'Product' },
    { key: 'tracking', label: 'Tracking No' },
    { key: 'price', label: 'Price' },
    { key: 'qty', label: 'Qty' },
    { key: 'date', label: 'Return Date' },
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing {filtered.length} of {orders.length} entries
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 w-48 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
          </div>
          <DataExport data={exportData} columns={exportColumns} filename="returned_orders" />
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#e6e9ed] bg-white">
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">#</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Order ID</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Customer</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Products</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Tracking No</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Price (Rs)</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px]">Qty</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px] hidden md:table-cell">Staff</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-600 text-[13px] hidden lg:table-cell">Return Date</th>
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
