export type RecordedDate = Date | string;
export interface RecordedOrderEvent {
    id: string;
    status: string;
    timestamp: RecordedDate;
    description?: string | null;
    location?: string | null;
}
export interface OrderHistoryInput {
    status: string;
    createdAt: RecordedDate;
    shippedAt?: RecordedDate | null;
    deliveredAt?: RecordedDate | null;
    trackingUpdates?: RecordedOrderEvent[];
    statusHistory?: RecordedOrderEvent[];
}
export interface OrderHistoryEvent extends RecordedOrderEvent {
    source: 'Order record' | 'Status history' | 'Courier update';
}
export const statusLabel = (status: string) => status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const shippedStatuses = ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'RTO'];
export const hasShipped = (order: OrderHistoryInput) => Boolean(order.shippedAt) || shippedStatuses.includes(order.status);
export const isClosedJourney = (status: string) => ['CANCELLED', 'RETURNED', 'RTO', 'DELIVERED'].includes(status);

/** Keep every recorded source event; sort copies, never the arrays supplied by the caller. */
export function orderHistory(order: OrderHistoryInput): OrderHistoryEvent[] {
    const events: OrderHistoryEvent[] = [
        ...(order.statusHistory || []).map(event => ({ ...event, source: 'Status history' as const, id: `status-${event.id}` })),
        ...(order.trackingUpdates || []).map(event => ({ ...event, source: 'Courier update' as const, id: `tracking-${event.id}` })),
    ];
    const addRecord = (status: string, timestamp: RecordedDate | null | undefined) => {
        if (!timestamp) return;
        if (!events.some(event => event.status === status && new Date(event.timestamp).getTime() === new Date(timestamp).getTime())) {
            events.push({ id: `record-${status}`, status, timestamp, source: 'Order record' });
        }
    };
    addRecord('CREATED', order.createdAt);
    addRecord('SHIPPED', order.shippedAt);
    addRecord('DELIVERED', order.deliveredAt);
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function upcomingOrderSteps(order: OrderHistoryInput): string[] {
    if (isClosedJourney(order.status)) return [];
    const recorded = new Set(orderHistory(order).map(event => event.status));
    const steps = hasShipped(order) ? ['IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'] : ['SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const lastKnown = Math.max(-1, ...steps.map((step, index) => recorded.has(step) || order.status === step ? index : -1));
    return steps.slice(lastKnown + 1);
}
