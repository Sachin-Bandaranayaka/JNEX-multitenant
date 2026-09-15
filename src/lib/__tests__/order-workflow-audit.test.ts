import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionOrder } from '../order-workflow';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), find: vi.fn(), update: vi.fn(), audit: vi.fn(), history: vi.fn(), reload: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock('@/lib/billing/charges', () => ({ accrueDeliveryCharge: vi.fn(), reverseDeliveryCharge: vi.fn() }));
vi.mock('@/lib/billing/credits', () => ({ captureForDelivery: vi.fn(), holdForShipment: vi.fn(), refundCapture: vi.fn(), releaseHold: vi.fn() }));
const input = { orderId: 'order-a', tenantId: 'tenant-a', userId: 'staff-a', to: 'SHIPPED' as const,
  shipping: { provider: 'TRANS_EXPRESS' as const, trackingNumber: 'waybill-a' } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue({ id: 'order-a', number: 269, status: 'CONFIRMED', shippingProvider: 'TRANS_EXPRESS', trackingNumber: null,
    tenant: { billingMode: 'POSTPAID' } });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.audit.mockResolvedValue({});
  mocks.reload.mockResolvedValue({ id: 'order-a', status: 'SHIPPED' });
  mocks.transaction.mockImplementation(async (run: (tx: unknown) => Promise<unknown>) => run({
    order: { findFirst: mocks.find, updateMany: mocks.update, findFirstOrThrow: mocks.reload },
    auditEvent: { create: mocks.audit }, orderStatusHistory: { updateMany: vi.fn(), create: mocks.history },
  }));
});
describe('transactional lifecycle audit', () => {
  it('records the status and courier assignment with the authenticated actor', async () => {
    await transitionOrder(input);
    expect(mocks.audit.mock.calls[0][0].data).toMatchObject({
      actorId: 'staff-a', tenantId: 'tenant-a', entityId: 'order-a', action: 'ORDER_STATUS_CHANGED',
      metadata: { orderNumber: 269, before: { status: 'CONFIRMED', trackingNumber: null },
        after: { status: 'SHIPPED', trackingNumber: 'waybill-a', shippingProvider: 'TRANS_EXPRESS' } },
    });
  });
  it('rejects the transaction if audit persistence fails', async () => {
    mocks.audit.mockRejectedValue(new Error('audit failed'));
    await expect(transitionOrder(input)).rejects.toThrow('audit failed');
    expect(mocks.reload).not.toHaveBeenCalled();
  });
  it('does not record a status change lost to a concurrent update', async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    await expect(transitionOrder(input)).rejects.toThrow('Order changed');
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
