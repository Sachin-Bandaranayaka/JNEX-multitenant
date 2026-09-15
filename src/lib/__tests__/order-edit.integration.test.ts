import { afterAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../prisma';
import { PATCH } from '../../app/api/orders/[orderId]/route';
const auth = vi.hoisted(() => ({ guard: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requirePermission: auth.guard, requireTenantAdmin: auth.guard }));
const enabled = process.env.JNEX_ISOLATED_DB_TEST === '1' && process.env.DATABASE_URL?.includes('127.0.0.1:55439/jnex_owner_test');
describe.skipIf(!enabled)('isolated PostgreSQL full order editing', () => {
  afterAll(async () => { await prisma.$disconnect(); });
  it('atomically changes reserved products and pricing, rejects overselling and shipped edits', async () => {
    const tenant = await prisma.tenant.create({ data: { name: `Order edit verification ${Date.now()}` } });
    const user = await prisma.user.create({ data: { email: `edit-${Date.now()}@example.invalid`, password: 'not-a-login-hash', name: 'Synthetic admin', role: 'ADMIN', permissions: [], tenantId: tenant.id } });
    auth.guard.mockResolvedValue({ ok: true, tenantId: tenant.id, session: { user: { id: user.id, tenantId: tenant.id, role: 'ADMIN' } } });
    const a = await prisma.product.create({ data: { tenantId: tenant.id, code: 'OLD', name: 'Old product', price: 100, stock: 8 } });
    const b = await prisma.product.create({ data: { tenantId: tenant.id, code: 'NEW', name: 'New product', price: 200, stock: 5 } });
    const lead = await prisma.lead.create({ data: { tenantId: tenant.id, productCode: a.code, userId: user.id, csvData: {}, status: 'CONFIRMED' } });
    const order = await prisma.order.create({ data: { id: `test-${Date.now()}`, tenantId: tenant.id, productId: a.id, leadId: lead.id, userId: user.id, quantity: 2, total: 200, status: 'PENDING', customerName: 'Synthetic', customerPhone: '0000000000', customerAddress: 'Test only' } });
    const params = { params: Promise.resolve({ orderId: order.id }) };
    const edit = (quantity: number) => PATCH(new Request('http://localhost/api/orders/test', { method: 'PATCH', body: JSON.stringify({ customerName: 'Synthetic updated', customerPhone: '0000000000', customerAddress: 'Test only', pricing: { productId: b.id, quantity, unitPrice: 200, discount: 20, deliveryFee: 50, prepaidAmount: 100 } }) }), params);
    expect((await edit(3)).status).toBe(200);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).stock).toBe(10);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: b.id } })).stock).toBe(2);
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ total: 630, codAmount: 530, productId: b.id, quantity: 3 });
    expect((await edit(10)).status).toBe(409);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).quantity).toBe(3);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: b.id } })).stock).toBe(2);
    await prisma.order.update({ where: { id: order.id }, data: { trackingNumber: 'SYNTHETIC-BOOKED' } });
    expect((await edit(2)).status).toBe(409);
  });
});
