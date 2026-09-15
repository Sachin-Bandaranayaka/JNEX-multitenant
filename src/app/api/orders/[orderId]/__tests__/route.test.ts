import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH } from '../route';

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), order: vi.fn(), tenant: vi.fn(), update: vi.fn(), audit: vi.fn(),
  lead: vi.fn(), reload: vi.fn(), transaction: vi.fn(),
}));
vi.mock('@/lib/authz', () => ({ requirePermission: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  order: { findFirst: mocks.order }, tenant: { findUnique: mocks.tenant }, $transaction: mocks.transaction,
} }));

const existing = {
  id: 'order-a', number: 269, status: 'CONFIRMED', shippedAt: null, trackingNumber: null,
  updatedAt: new Date('2026-01-01'), customerName: 'Before', customerPhone: '0711111111',
  customerSecondPhone: null, customerAddress: 'Old address', notes: null,
  shippingCityId: null, customerCity: '', lead: { id: 'lead-a', csvData: {} },
};
const request = () => new Request('http://localhost/api/orders/order-a', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ customerName: 'After', customerPhone: '0722222222', customerAddress: 'New address' }),
});
const params = { params: Promise.resolve({ orderId: 'order-a' }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ ok: true, session: { user: { id: 'actor-a', tenantId: 'tenant-a' } } });
  mocks.order.mockResolvedValue(existing);
  mocks.tenant.mockResolvedValue({ transExpressApiKey: null });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.reload.mockResolvedValue(existing);
  mocks.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => run({
    order: { updateMany: mocks.update, findFirstOrThrow: mocks.reload },
    auditEvent: { create: mocks.audit }, lead: { update: mocks.lead },
  }));
});

describe('pre-shipment customer edits', () => {
  it('records the actor and before/after values inside the edit transaction', async () => {
    expect((await PATCH(request(), params)).status).toBe(200);
    expect(mocks.guard).toHaveBeenCalledWith('EDIT_ORDERS');
    expect(mocks.update.mock.calls[0][0].where).toMatchObject({
      tenantId: 'tenant-a', updatedAt: existing.updatedAt, shippedAt: null, trackingNumber: null,
    });
    expect(mocks.audit.mock.calls[0][0].data).toMatchObject({
      actorId: 'actor-a', tenantId: 'tenant-a', action: 'ORDER_EDITED',
      metadata: { orderNumber: 269, before: { customerName: 'Before' }, after: { customerName: 'After' } },
    });
  });
  it('blocks an already booked shipment even if its status still says confirmed', async () => {
    mocks.order.mockResolvedValue({ ...existing, trackingNumber: 'booked-waybill' });
    expect((await PATCH(request(), params)).status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('does not write an audit event or change the lead when the order changed concurrently', async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    const response = await PATCH(request(), params);
    expect(response.status).toBe(409);
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.lead).not.toHaveBeenCalled();
  });
  it('honors rejected permission guards before querying an order', async () => {
    mocks.guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await PATCH(request(), params)).status).toBe(403);
    expect(mocks.order).not.toHaveBeenCalled();
  });
});
