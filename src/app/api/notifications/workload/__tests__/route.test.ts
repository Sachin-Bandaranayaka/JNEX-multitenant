import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';
const mocks = vi.hoisted(() => ({ guard: vi.fn(), leads: vi.fn(), reminders: vi.fn(), products: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requireAnyPermission: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ getScopedPrismaClient: () => ({ lead: { count: mocks.leads }, leadReminder: { count: mocks.reminders }, product: { count: mocks.products, fields: { lowStockAlert: 'threshold-field' } } }) }));
const user = { id: 'staff-a', role: 'TEAM_MEMBER', permissions: ['VIEW_LEADS'] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ ok: true, tenantId: 'tenant-a', session: { user } });
  mocks.leads.mockResolvedValue(20); mocks.reminders.mockResolvedValue(2); mocks.products.mockResolvedValue(3);
});
describe('personal workload counts', () => {
  it('restricts team members to owned leads and hides stock without permission', async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ pendingLeads: 20, dueReminders: 2, lowStockProducts: null, scope: 'assigned' });
    expect(mocks.leads).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a', status: 'PENDING', userId: 'staff-a' } });
    expect(mocks.reminders).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a', status: 'PENDING', remindAt: { lte: expect.any(Date) }, lead: { tenantId: 'tenant-a', status: { in: ['PENDING', 'NO_ANSWER'] }, userId: 'staff-a' } } });
    expect(mocks.products).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('shows tenant-wide counts for admins and compares each active product to its threshold', async () => {
    mocks.guard.mockResolvedValue({ ok: true, tenantId: 'tenant-a', session: { user: { ...user, role: 'ADMIN' } } });
    expect(await (await GET()).json()).toEqual({ pendingLeads: 20, dueReminders: 2, lowStockProducts: 3, scope: 'tenant' });
    expect(mocks.leads).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a', status: 'PENDING' } });
    expect(mocks.products).toHaveBeenCalledWith({ where: { tenantId: 'tenant-a', isActive: true, stock: { lte: 'threshold-field' } } });
  });
  it('does not query leads for a product-only user', async () => {
    mocks.guard.mockResolvedValue({ ok: true, tenantId: 'tenant-a', session: { user: { ...user, permissions: ['VIEW_PRODUCTS'] } } });
    const body = await (await GET()).json();
    expect(body.pendingLeads).toBeNull(); expect(body.dueReminders).toBeNull();
    expect(mocks.leads).not.toHaveBeenCalled(); expect(mocks.reminders).not.toHaveBeenCalled();
  });
  it('returns an error instead of zero counts on failure', async () => {
    mocks.leads.mockRejectedValue(new Error('unavailable'));
    expect((await GET()).status).toBe(503);
  });
  it('enforces permission guard', async () => {
    mocks.guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await GET()).status).toBe(403);
    expect(mocks.leads).not.toHaveBeenCalled();
  });
});
