import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../route';

const mocks = vi.hoisted(() => ({
  guard: vi.fn(), orders: vi.fn(), tenant: vi.fn(), batchFind: vi.fn(), batchCreate: vi.fn(), batchDelete: vi.fn(),
  itemDelete: vi.fn(), itemMax: vi.fn(), itemCreate: vi.fn(), itemFind: vi.fn(), itemUpdate: vi.fn(),
  raw: vi.fn(), plan: vi.fn(), book: vi.fn(), transition: vi.fn(),
}));
vi.mock('@/lib/authz', () => ({ requireAnyPermission: mocks.guard, requirePermission: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  order: { findMany: mocks.orders }, tenant: { findUnique: mocks.tenant },
  shipmentBatch: { findFirst: mocks.batchFind, create: mocks.batchCreate, delete: mocks.batchDelete },
  shipmentBatchItem: { deleteMany: mocks.itemDelete, aggregate: mocks.itemMax, createMany: mocks.itemCreate, findMany: mocks.itemFind, update: mocks.itemUpdate },
  $executeRaw: mocks.raw,
} }));
vi.mock('@/lib/billing/credits', () => ({ planBulkShipment: mocks.plan }));
vi.mock('@/lib/order-workflow', () => ({ transitionOrder: mocks.transition }));
vi.mock('@/lib/shipping/trans-express', () => ({ TransExpressProvider: class { createBulkShipmentsWithCityIds = mocks.book; } }));

const order = (id: string, extra: Record<string, unknown> = {}) => ({
  id, number: Number(id.replace(/\D/g, '')), orderCode: null, status: 'CONFIRMED', total: 1000, codAmount: null,
  customerName: 'C', customerAddress: 'A', customerPhone: '07', customerSecondPhone: null,
  shippingLocationProvider: 'TRANS_EXPRESS', shippingCityId: 864, shippingProvider: null,
  shippedAt: null, trackingNumber: null, shipmentBatchItem: null, ...extra,
});
const post = (body: Record<string, unknown>) => POST(new Request('http://localhost/api/shipping/batches', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'TRANS_EXPRESS', ...body }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ ok: true, tenantId: 'tenant-a', session: { user: { id: 'user-a' } } });
  mocks.tenant.mockResolvedValue({ transExpressApiKey: 'key', transExpressOrderPrefix: 'DC' });
  mocks.plan.mockImplementation(async (_tenant: string, rows: Array<{ orderId: string }>) => ({ allowed: rows.map(row => row.orderId), blocked: [] }));
  mocks.batchCreate.mockResolvedValue({ id: 'batch-new' });
  mocks.itemMax.mockResolvedValue({ _max: { position: null } });
  mocks.itemFind.mockImplementation(async ({ where }: { where: { orderId: { in: string[] } } }) => where.orderId.in.map(orderId => ({ orderId })));
  mocks.book.mockImplementation(async (rows: Array<{ orderId: string; orderNo: string }>) => rows.map(row => ({ ...row, trackingNumber: `WB-${row.orderId}` })));
  mocks.transition.mockResolvedValue({});
});

describe('shipment batches', () => {
  it('claims, books, saves every waybill, then records each order', async () => {
    mocks.orders.mockResolvedValue([order('o1'), order('o2')]);
    const response = await post({ orderIds: ['o1', 'o2'] });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'batch-new', shippedCount: 2, errors: [] });
    expect(mocks.itemCreate.mock.calls[0][0].data).toEqual([{ batchId: 'batch-new', orderId: 'o1', position: 0 }, { batchId: 'batch-new', orderId: 'o2', position: 1 }]);
    expect(mocks.raw).toHaveBeenCalledTimes(1);
    expect(mocks.itemCreate.mock.invocationCallOrder[0]).toBeLessThan(mocks.book.mock.invocationCallOrder[0]);
    expect(mocks.raw.mock.invocationCallOrder[0]).toBeLessThan(mocks.transition.mock.invocationCallOrder[0]);
    expect(mocks.transition.mock.calls.map(call => call[0].shipping.trackingNumber)).toEqual(['WB-o1', 'WB-o2']);
  });

  it('records a booked but unrecorded order without booking it again', async () => {
    mocks.orders.mockResolvedValue([order('o1', { trackingNumber: 'WB-old', shippingProvider: 'TRANS_EXPRESS', shipmentBatchItem: { id: 'item-1', batchId: 'batch-old', batch: { createdAt: new Date() } } })]);
    const response = await post({ orderIds: ['o1'] });
    expect(response.status).toBe(201);
    expect(mocks.book).not.toHaveBeenCalled();
    expect(mocks.itemUpdate).toHaveBeenCalledWith({ where: { orderId: 'o1' }, data: { batchId: 'batch-new', position: 0 } });
    expect(mocks.transition.mock.calls[0][0].shipping).toEqual({ provider: 'TRANS_EXPRESS', trackingNumber: 'WB-old' });
  });

  it('refuses an order another request is still shipping and never books it', async () => {
    mocks.orders.mockResolvedValue([order('o1', { shipmentBatchItem: { id: 'item-1', batchId: 'batch-other', batch: { createdAt: new Date() } } })]);
    const response = await post({ orderIds: ['o1'] });
    expect(response.status).toBe(422);
    expect((await response.json()).errors[0].error).toMatch(/still in progress/);
    expect(mocks.book).not.toHaveBeenCalled();
    expect(mocks.batchCreate).not.toHaveBeenCalled();
  });

  it('does not re-book an old claim without a waybill until a person confirms it', async () => {
    const dead = { id: 'item-1', batchId: 'batch-dead', batch: { createdAt: new Date(Date.now() - 60 * 60 * 1000) } };
    mocks.orders.mockResolvedValue([order('o1', { orderCode: 'DC1628', shipmentBatchItem: dead })]);
    const refused = await post({ orderIds: ['o1'] });
    expect(refused.status).toBe(422);
    expect((await refused.json()).errors[0]).toMatchObject({ code: 'BOOKING_UNCONFIRMED', error: expect.stringContaining('order no. DC1628') });
    expect(mocks.book).not.toHaveBeenCalled();

    expect((await post({ orderIds: ['o1'], confirmedUnbooked: ['o1'] })).status).toBe(201);
    expect(mocks.itemDelete.mock.calls[0][0].where).toEqual({ id: { in: ['item-1'] }, order: { trackingNumber: null } });
    expect(mocks.book).toHaveBeenCalledTimes(1);
  });

  it('ignores a confirmation for a claim that is still in progress', async () => {
    mocks.orders.mockResolvedValue([order('o1', { shipmentBatchItem: { id: 'item-1', batchId: 'batch-other', batch: { createdAt: new Date() } } })]);
    expect((await post({ orderIds: ['o1'], confirmedUnbooked: ['o1'] })).status).toBe(422);
    expect(mocks.book).not.toHaveBeenCalled();
  });

  it('skips an order whose claim was lost to a concurrent request', async () => {
    mocks.orders.mockResolvedValue([order('o1'), order('o2')]);
    mocks.itemFind.mockResolvedValue([{ orderId: 'o2' }]);
    const body = await (await post({ orderIds: ['o1', 'o2'] })).json();
    expect(mocks.book.mock.calls[0][0].map((row: { orderId: string }) => row.orderId)).toEqual(['o2']);
    expect(body.errors).toEqual([expect.objectContaining({ orderId: 'o1', error: expect.stringMatching(/still in progress/) })]);
  });

  it('releases the claim when the courier rejects an order', async () => {
    mocks.orders.mockResolvedValue([order('o1'), order('o2')]);
    mocks.book.mockResolvedValue([{ orderId: 'o1', orderNo: 'x', trackingNumber: 'WB-1' }, { orderId: 'o2', orderNo: 'y', error: 'bad phone' }]);
    const body = await (await post({ orderIds: ['o1', 'o2'] })).json();
    expect(body.shippedCount).toBe(1);
    expect(mocks.itemDelete).toHaveBeenCalledWith({ where: { batchId: 'batch-new', orderId: { in: ['o2'] } } });
  });

  it('keeps the waybill and claim when recording fails so a retry can finish it', async () => {
    mocks.orders.mockResolvedValue([order('o1')]);
    mocks.transition.mockRejectedValue(new Error('Order changed while it was being updated; please retry'));
    const response = await post({ orderIds: ['o1'] });
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.id).toBe('batch-new');
    expect(body.errors[0].error).toMatch(/Booked as WB-o1 but not recorded/);
    expect(mocks.itemDelete).not.toHaveBeenCalled();
    expect(mocks.batchDelete).not.toHaveBeenCalled();
  });

  it('adds later chunks to the batch the first chunk created', async () => {
    mocks.orders.mockResolvedValue([order('o4')]);
    mocks.batchFind.mockResolvedValue({ id: 'batch-new' });
    mocks.itemMax.mockResolvedValue({ _max: { position: 2 } });
    expect((await post({ orderIds: ['o4'], batchId: 'batch-new' })).status).toBe(201);
    expect(mocks.batchFind.mock.calls[0][0].where).toEqual({ id: 'batch-new', tenantId: 'tenant-a', userId: 'user-a', provider: 'TRANS_EXPRESS' });
    expect(mocks.batchCreate).not.toHaveBeenCalled();
    expect(mocks.itemCreate.mock.calls[0][0].data).toEqual([{ batchId: 'batch-new', orderId: 'o4', position: 3 }]);
  });

  it('removes a batch it created when nothing could be booked', async () => {
    mocks.orders.mockResolvedValue([order('o1')]);
    mocks.book.mockResolvedValue([{ orderId: 'o1', orderNo: 'x', error: 'courier down' }]);
    const response = await post({ orderIds: ['o1'] });
    expect(response.status).toBe(422);
    expect((await response.json()).id).toBeNull();
    expect(mocks.batchDelete).toHaveBeenCalledWith({ where: { id: 'batch-new' } });
  });
});
