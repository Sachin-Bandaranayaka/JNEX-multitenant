import { describe, expect, it } from 'vitest';
import { shippingWhere, summarizeShipments, normalizeShippingFilters } from '../shipping-workspace';
describe('shipping workspace scopes', () => {
  it('drops incompatible filters when moving to another section', () => {
    expect(normalizeShippingFilters('ship', { status: 'DELIVERED', courier: 'ROYAL_EXPRESS', view: 'exceptions', q: '#269' })).toEqual({ q: '#269' });
    expect(normalizeShippingFilters('delivery', { status: 'CONFIRMED', courier: 'TRANS_EXPRESS' })).toEqual({ courier: 'TRANS_EXPRESS' });
  });
  it('limits ship queue to unbooked pending or confirmed orders', () => {
    expect(shippingWhere('tenant-a', 'ship', {})).toEqual({ tenantId: 'tenant-a', AND: [{ status: { in: ['PENDING', 'CONFIRMED'] }, shippedAt: null, trackingNumber: null }] });
  });
  it('preserves delivered and returned shipments in history including legacy dates', () => {
    expect(shippingWhere('tenant-a', 'shipped', {}).AND).toContainEqual({ OR: [{ shippedAt: { not: null } }, { status: { in: ['SHIPPED', 'DELIVERED', 'RETURNED', 'RESCHEDULED'] } }] });
  });
  it('applies tenant, historical courier, staff, exception and Sri Lanka date filters', () => {
    const where = shippingWhere('tenant-a', 'delivery', { courier: 'ROYAL_EXPRESS', staff: 'staff-a', from: '2026-09-14', to: '2026-09-14', view: 'exceptions', status: 'RETURNED' });
    expect(where.tenantId).toBe('tenant-a');
    expect(where.AND).toEqual(expect.arrayContaining([{ shippingProvider: 'ROYAL_EXPRESS' }, { userId: 'staff-a' }, { status: 'RETURNED' }, { shippedAt: { gte: new Date('2026-09-13T18:30:00Z'), lt: new Date('2026-09-14T18:30:00Z') } }, { trackingUpdates: { some: { isException: true } } }]));
  });
  it('ignores impossible calendar dates instead of rolling into another month', () => {
    expect(shippingWhere('tenant-a', 'ship', { from: '2026-02-31', to: 'invalid' }).AND).toHaveLength(1);
  });
  it('uses creation date for the ship queue and ignores invalid enum filters', () => {
    const where = shippingWhere('tenant-a', 'ship', { from: '2026-09-14', courier: 'unknown', status: 'unknown' });
    expect(where.AND).toHaveLength(2);
    expect(where.AND).toContainEqual({ createdAt: { gte: new Date('2026-09-13T18:30:00Z') } });
  });
});
describe('shipment summary', () => {
  it('counts saved order values by courier without conflating cancellation or COD', () => {
    const rows = [
      { status: 'DELIVERED', shippingProvider: 'TRANS_EXPRESS', total: 1350, quantity: 2 },
      { status: 'SHIPPED', shippingProvider: 'TRANS_EXPRESS', total: 900, quantity: 1 },
      { status: 'RETURNED', shippingProvider: 'ROYAL_EXPRESS', total: 500, quantity: 1 },
      { status: 'CANCELLED', shippingProvider: null, total: 100, quantity: 1 },
    ];
    expect(summarizeShipments(rows)).toEqual([
      { courier: 'ROYAL_EXPRESS', orders: 1, quantity: 1, total: 500, delivered: 0, returned: 1, inProgress: 0, other: 0 },
      { courier: 'TRANS_EXPRESS', orders: 2, quantity: 3, total: 2250, delivered: 1, returned: 0, inProgress: 1, other: 0 },
      { courier: 'UNASSIGNED', orders: 1, quantity: 1, total: 100, delivered: 0, returned: 0, inProgress: 0, other: 1 },
    ]);
  });
  it('returns no groups for empty results', () => expect(summarizeShipments([])).toEqual([]));
});
