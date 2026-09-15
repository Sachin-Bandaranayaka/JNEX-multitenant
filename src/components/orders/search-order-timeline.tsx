'use client';

import { useState } from 'react';
import { EnhancedOrderTimeline } from './enhanced-order-timeline';
import type { OrderHistoryInput } from '@/lib/order-presentation';

export function SearchOrderTimeline({ orderId, number }: { orderId: string; number: number }) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<(OrderHistoryInput & { number: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/timeline`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load the order timeline.');
      setOrder(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load timeline.');
    } finally {
      setLoading(false);
    }
  };
  const panelId = `timeline-${orderId}`;
  return (
    <div className="w-full min-w-0 border-t border-border pt-3">
      <button type="button" aria-expanded={open} aria-controls={panelId}
        className="text-sm font-semibold text-primary hover:underline"
        onClick={() => { setOpen(!open); if (!open && !order && !loading) void load(); }}>
        {open ? 'Hide' : 'View'} timeline · #{number}
      </button>
      {open && <div id={panelId} className="mt-4 rounded-xl border border-border bg-card p-4">
        {loading && <p role="status" className="text-sm text-muted-foreground">Loading recorded events…</p>}
        {error && <div role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => void load()}>Retry</button></div>}
        {order && <EnhancedOrderTimeline order={order} />}
      </div>}
    </div>
  );
}
