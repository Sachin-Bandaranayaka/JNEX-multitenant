import { describe, expect, it } from 'vitest';
import { hasShipped, orderHistory, upcomingOrderSteps } from '../order-presentation';

const createdAt = new Date('2026-01-01T09:00:00Z');
const base = { status: 'CONFIRMED', createdAt, trackingUpdates: [] };
describe('order presentation history', () => {
    it('does not count courier selection as shipment', () => {
        const selected = { ...base, shippingProvider: 'TRANS_EXPRESS' };
        expect(hasShipped(selected)).toBe(false);
        expect(upcomingOrderSteps(selected)[0]).toBe('SHIPPED');
    });
    it('combines both recorded histories in ascending order without mutating source arrays', () => {
        const trackingUpdates = Object.freeze([
            { id: '2', status: 'OUT_FOR_DELIVERY', timestamp: new Date('2026-01-03') },
            { id: '1', status: 'IN_TRANSIT', timestamp: new Date('2026-01-02') },
        ]);
        const order = { ...base, trackingUpdates: [...trackingUpdates], statusHistory: [{ id: '1', status: 'CONFIRMED', timestamp: new Date('2026-01-01T10:00:00Z') }] };
        Object.freeze(order.trackingUpdates);
        expect(orderHistory(order).map(event => event.status)).toEqual(['CREATED', 'CONFIRMED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY']);
        expect(order.trackingUpdates[0].id).toBe('2');
    });
    it('records shipment dates without fabricating confirmation timestamps', () => {
        const events = orderHistory({ ...base, status: 'SHIPPED', shippedAt: new Date('2026-01-02') });
        expect(events.map(event => event.status)).toEqual(['CREATED', 'SHIPPED']);
        expect(orderHistory({ ...base, status: 'SHIPPED' })).toHaveLength(1);
    });
    it.each(['CANCELLED', 'RETURNED', 'RTO', 'DELIVERED'])('has no upcoming delivery for %s', status => {
        expect(upcomingOrderSteps({ ...base, status })).toEqual([]);
    });
    it('does not repeat upcoming transit once out for delivery is recorded', () => {
        expect(upcomingOrderSteps({ ...base, status: 'SHIPPED', trackingUpdates: [{ id: '1', status: 'OUT_FOR_DELIVERY', timestamp: createdAt }] })).toEqual(['DELIVERED']);
    });
});
