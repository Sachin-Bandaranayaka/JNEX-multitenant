import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

const mocks = vi.hoisted(() => ({ session: vi.fn(), scoped: vi.fn(), findMany: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ getScopedPrismaClient: mocks.scoped }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { tenantId: 'tenant-a' } });
  mocks.scoped.mockReturnValue({ order: { findMany: mocks.findMany } });
  mocks.findMany.mockResolvedValue([]);
});

describe('order search API', () => {
  it('returns saved total and business number even when catalog price has changed', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'legacy-internal-id', number: 611, total: 1350, quantity: 1,
      customerName: 'Test customer', customerPhone: '0712345678', customerAddress: 'Test address',
      createdAt: new Date('2026-01-01'), status: 'CONFIRMED', product: { name: 'Soap', price: 1340 },
    }]);
    const response = await GET(new Request('http://localhost/api/search?q=611'));
    const result = await response.json();
    expect(result[0].orders[0]).toMatchObject({ number: 611, total: 1350 });
    expect(mocks.scoped).toHaveBeenCalledWith('tenant-a');
    expect(mocks.findMany.mock.calls[0][0].where.OR).toContainEqual({ number: 611 });
  });
  it('rejects an unauthenticated request before reading tenant data', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/api/search?q=611'))).status).toBe(401);
    expect(mocks.scoped).not.toHaveBeenCalled();
  });
  it('rejects blank searches rather than returning the entire tenant order list', async () => {
    expect((await GET(new Request('http://localhost/api/search?q=%20'))).status).toBe(400);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
