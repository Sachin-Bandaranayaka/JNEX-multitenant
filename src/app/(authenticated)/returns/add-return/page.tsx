'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

interface ReturnedOrder {
  id: string;
  number: number;
  trackingNumber: string;
  customerName: string;
  product: { name: string; price: number; code: string };
  quantity: number;
  status: string;
  assignedTo: { name: string | null } | null;
}

export default function AddReturnPage() {
  const [waybill, setWaybill] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [returnedOrders, setReturnedOrders] = useState<ReturnedOrder[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  const handleAddReturn = async () => {
    if (!waybill.trim()) {
      toast.error('Please enter a waybill number');
      return;
    }

    setIsLoading(true);
    setSuccessMessage('');

    try {
      const res = await fetch('/api/returns/waybill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waybill: waybill.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process return');
      }

      setReturnedOrders((prev) => [data, ...prev]);
      setSuccessMessage('Return Added Successfully!');
      setWaybill('');
      toast.success('Return added successfully');

      // Clear success message after 4 seconds
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Return Item</h1>
      </div>

      {/* Waybill Input — Genzo style */}
      <div className="flex flex-wrap items-end gap-4 p-5 bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground whitespace-nowrap">Waybill No</label>
          <input
            type="text"
            value={waybill}
            onChange={(e) => setWaybill(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddReturn()}
            placeholder="Enter tracking/waybill number"
            className="h-10 w-64 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none"
          />
        </div>
        <button
          onClick={handleAddReturn}
          disabled={isLoading || !waybill.trim()}
          className="h-10 px-6 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
        >
          {isLoading ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            <TruckIcon className="h-4 w-4" />
          )}
          Add Return
        </button>

        {successMessage && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium animate-in fade-in">
            <CheckCircleIcon className="h-4 w-4" />
            {successMessage}
          </div>
        )}
      </div>

      {/* Returned Orders Table */}
      <div className="bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Order ID</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Products</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Tracking No</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Price (Rs)</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {returnedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No data available in table
                  </td>
                </tr>
              ) : (
                returnedOrders.map((order, idx) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/orders/${order.id}`} className="text-primary hover:underline font-medium">
                        {order.number || order.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{order.product.name}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-primary font-medium">{order.trackingNumber}</span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">{order.product.price.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-foreground">{order.quantity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-border/30 text-xs text-muted-foreground">
          Showing {returnedOrders.length > 0 ? 1 : 0} to {returnedOrders.length} of {returnedOrders.length} entries
        </div>
      </div>
    </div>
  );
}
