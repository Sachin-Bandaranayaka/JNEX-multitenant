import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../route';

const mocks = vi.hoisted(() => ({ guard: vi.fn(), shipBatch: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requireAnyPermission: mocks.guard }));
vi.mock('@/lib/shipping/ship-batch', () => ({ shipBatch: mocks.shipBatch }));

const post = (body: Record<string, unknown>) => POST(new Request('http://localhost/api/shipping/trans-express/bulk-create', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ ok: true, tenantId: 'tenant-a', session: { user: { id: 'user-a' } } });
  mocks.shipBatch.mockResolvedValue({ ok: true, id: 'batch-a', shipped: [{ orderId: 'o1', number: 1, trackingNumber: 'WB1' }], errors: [{ orderId: 'o2', number: 2, error: 'unconfirmed', code: 'BOOKING_UNCONFIRMED' }] });
});

describe('orders-page bulk ship', () => {
  it('ships through the claim-first batch flow with the chosen city and weight', async () => {
    const response = await post({ orders: [{ orderId: 'o1', cityId: 12, weight: 2 }, { orderId: 'o2' }], weight: 1, batchId: 'batch-a', confirmedUnbooked: ['o2'] });
    expect(mocks.shipBatch).toHaveBeenCalledWith({
      tenantId: 'tenant-a', userId: 'user-a', provider: 'TRANS_EXPRESS', orderIds: ['o1', 'o2'],
      overrides: { o1: { cityId: 12, weight: 2 }, o2: { cityId: undefined, weight: undefined } },
      weight: 1, batchId: 'batch-a', confirmedUnbooked: ['o2'],
    });
    expect(await response.json()).toEqual({ id: 'batch-a', results: [
      { orderId: 'o1', orderNo: '#1', trackingNumber: 'WB1' },
      { orderId: 'o2', orderNo: '#2', error: 'unconfirmed', code: 'BOOKING_UNCONFIRMED' },
    ] });
  });

  it('rejects a request with no orders', async () => {
    expect((await post({})).status).toBe(400);
    expect(mocks.shipBatch).not.toHaveBeenCalled();
  });
});
