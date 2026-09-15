import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';
const mocks = vi.hoisted(() => ({ guard: vi.fn(), find: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requirePermission: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findFirst: mocks.find } } }));
beforeEach(() => { vi.clearAllMocks(); mocks.guard.mockResolvedValue({ ok: true, tenantId: 'tenant-a' }); });
const request = new Request('http://localhost/api/orders/order-a/timeline');
const params = { params: Promise.resolve({ orderId: 'order-a' }) };
describe('saved order timeline', () => {
  it('scopes lookup and returns a missing response for inaccessible orders', async () => {
    mocks.find.mockResolvedValue(null);
    expect((await GET(request, params)).status).toBe(404);
    expect(mocks.find.mock.calls[0][0].where).toEqual({ id: 'order-a', tenantId: 'tenant-a' });
  });
  it('returns recorded events without allowing cached private data', async () => {
    mocks.find.mockResolvedValue({ number: 269, trackingUpdates: [], statusHistory: [] });
    const response = await GET(request, params);
    expect(await response.json()).toMatchObject({ number: 269 });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('enforces order-view permission before querying', async () => {
    mocks.guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await GET(request, params)).status).toBe(403);
    expect(mocks.find).not.toHaveBeenCalled();
  });
});
