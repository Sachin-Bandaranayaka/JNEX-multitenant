import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';
const mocks = vi.hoisted(() => ({ guard: vi.fn(), users: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requireTenantAdmin: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ getScopedPrismaClient: () => ({ user: { findMany: mocks.users } }) }));
beforeEach(() => { vi.clearAllMocks(); mocks.guard.mockResolvedValue({ ok: true, tenantId: 'tenant-a' }); });
describe('import assignees', () => {
  it('lists only active tenant staff with minimal fields and no caching', async () => {
    mocks.users.mockResolvedValue([{ id: 'staff', name: 'Staff', email: 'staff@example.test' }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.users).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a', isActive: true, role: { not: 'SUPER_ADMIN' } }, select: { id: true, name: true, email: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  });
  it('rejects non-administrators', async () => {
    mocks.guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await GET()).status).toBe(403);
    expect(mocks.users).not.toHaveBeenCalled();
  });
  it('reports unavailable staff without silently giving an empty list', async () => {
    mocks.users.mockRejectedValue(new Error('unavailable'));
    expect((await GET()).status).toBe(503);
  });
});
