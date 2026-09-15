'use client';

import { TruckIcon } from '@heroicons/react/24/outline';
import { EnhancedOrderTimeline } from './enhanced-order-timeline';
import { hasShipped, orderHistory, OrderHistoryInput, statusLabel } from '@/lib/order-presentation';

export function OrderJourneyHeader({ order }: { order: OrderHistoryInput & { number: number; shippingProvider?: string | null; trackingNumber?: string | null } }) {
    const events = orderHistory(order);
    const latestEvent = events[events.length - 1];
    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-foreground">Order journey</h2>
                    <p className="text-sm text-muted-foreground mt-1">Current status: <span className="font-medium text-foreground">{statusLabel(order.status)}</span></p>
                </div>
                <div className="flex min-w-0 items-center gap-2 text-sm">
                    <TruckIcon className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 break-words [overflow-wrap:anywhere]"><p className="text-foreground">{hasShipped(order) ? 'Courier' : 'Selected courier'}: {order.shippingProvider ? statusLabel(order.shippingProvider) : 'Not assigned'}</p><p className="text-xs text-muted-foreground mt-1">Tracking: {order.trackingNumber || 'Not recorded'}</p></div>
                </div>
            </div>
            <details className="group">
                <summary className="cursor-pointer px-6 py-4 text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-4px]">
                    View order timeline · {events.length} recorded {events.length === 1 ? 'event' : 'events'}
                    {latestEvent && <span className="ml-2 font-normal text-muted-foreground break-words">Latest recorded: {statusLabel(latestEvent.status)}</span>}
                </summary>
                <div className="px-6 pb-6"><EnhancedOrderTimeline order={order} /></div>
            </details>
        </div>
    );
}
