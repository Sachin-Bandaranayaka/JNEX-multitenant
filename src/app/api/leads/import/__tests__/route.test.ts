import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../route';
const mocks = vi.hoisted(() => ({ permission: vi.fn(), admin: vi.fn(), users: vi.fn(), products: vi.fn(), create: vi.fn(), transaction: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requirePermission: mocks.permission, requireTenantAdmin: mocks.admin }));
vi.mock('@/lib/prisma', () => ({ getScopedPrismaClient: () => ({ user: { findMany: mocks.users }, product: { findMany: mocks.products }, lead: { create: mocks.create }, auditEvent: { create: mocks.audit }, $transaction: mocks.transaction }) }));
const staffA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const staffB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const lead = { customer_name: 'සචිනි', phone: '0771234567', address: 'කොළඹ', product_code: 'SOAP' };
const request = (assigneeIds?: string[]) => new Request('http://localhost/api/leads/import', { method: 'POST', body: JSON.stringify({ action: 'import', leads: [lead, lead, lead], assigneeIds }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({ ok: true, tenantId: 'tenant-a', session: { user: { id: staffA } } });
  mocks.admin.mockResolvedValue({ ok: true, tenantId: 'tenant-a' });
  mocks.users.mockResolvedValue([{ id: staffA }, { id: staffB }]);
  mocks.products.mockResolvedValue([{ code: 'Soap' }]);
  mocks.create.mockReturnValue(Promise.resolve({ id: 'lead' }));
  mocks.audit.mockReturnValue(Promise.resolve({ id: 'audit' }));
  mocks.transaction.mockImplementation((operations) => Promise.all(operations));
});
describe('lead import staff assignment', () => {
  it('distributes evenly, preserves Sinhala, and connects the canonical product code', async () => {
    const response = await POST(request([staffA, staffB, staffA]));
    expect(response.status).toBe(200);
    expect((await response.json()).count).toBe(3);
    expect(mocks.transaction.mock.calls[0][0]).toHaveLength(4);
    expect(mocks.audit).toHaveBeenCalledWith({ data: { tenantId: 'tenant-a', actorId: staffA, action: 'LEADS_IMPORTED', entityType: 'Lead', metadata: { leadCount: 3, assigneeIds: [staffA, staffB] } } });
    expect(mocks.users).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [staffA, staffB] }, tenantId: 'tenant-a', isActive: true, role: { not: 'SUPER_ADMIN' } } }));
    const data = mocks.create.mock.calls.map(([arg]) => arg.data);
    expect(data.map(row => row.assignedTo.connect.id)).toEqual([staffA, staffB, staffA]);
    expect(data[0].csvData.customer_name).toBe('සචිනි');
    expect(data[0].csvData.address).toBe('කොළඹ');
    expect(data[0].product.connect.code_tenantId).toEqual({ code: 'Soap', tenantId: 'tenant-a' });
  });
  it('defaults to the uploading user with no staff selection', async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.create.mock.calls.every(([arg]) => arg.data.assignedTo.connect.id === staffA)).toBe(true);
  });
  it('blocks assignment by non-admin importers before creating leads', async () => {
    mocks.admin.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await POST(request([staffB]))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('rejects inactive or foreign assignees', async () => {
    mocks.users.mockResolvedValue([{ id: staffA }]);
    expect((await POST(request([staffA, staffB]))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
