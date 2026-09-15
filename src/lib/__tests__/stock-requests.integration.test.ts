import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../prisma';
import { createStockRequest, reviewStockRequest } from '../stock-change-requests';
const enabled = process.env.JNEX_ISOLATED_DB_TEST === '1' && process.env.DATABASE_URL?.includes('127.0.0.1:55439/jnex_owner_test');
describe.skipIf(!enabled)('isolated PostgreSQL stock approvals', () => {
  afterAll(async () => { await prisma.$disconnect(); });
  it('applies one concurrent approval and rolls back insufficient-stock decisions', async () => {
    const tenant = await prisma.tenant.create({ data: { name: `Isolated verification ${Date.now()}` } });
    const user = await prisma.user.create({ data: { email: `test-${Date.now()}@example.invalid`, name: 'Synthetic reviewer', password: 'not-a-login-hash', role: 'SUPER_ADMIN', permissions: [], tenantId: tenant.id } });
    const product = await prisma.product.create({ data: { tenantId: tenant.id, code: 'TEST', name: 'Synthetic stock', price: 100, stock: 10 } });
    const request = await createStockRequest(tenant.id, user.id, { productId: product.id, kind: 'WASTE', quantity: -3, reason: 'Synthetic damaged stock' });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(10);
    const results = await Promise.allSettled([
      reviewStockRequest(request.id, user.id, 'APPROVED', 'Synthetic verification'),
      reviewStockRequest(request.id, user.id, 'APPROVED', 'Synthetic verification'),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(7);
    expect(await prisma.stockAdjustment.count({ where: { tenantId: tenant.id } })).toBe(1);
    const oversized = await createStockRequest(tenant.id, user.id, { productId: product.id, kind: 'WASTE', quantity: -20, reason: 'Synthetic excessive request' });
    await expect(reviewStockRequest(oversized.id, user.id, 'APPROVED', 'Synthetic verification')).rejects.toThrow('Insufficient');
    expect((await prisma.stockChangeRequest.findUniqueOrThrow({ where: { id: oversized.id } })).status).toBe('PENDING');
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(7);
    await reviewStockRequest(oversized.id, user.id, 'REJECTED', 'Synthetic rejection');
    expect(await prisma.stockAdjustment.count({ where: { tenantId: tenant.id } })).toBe(1);
  });
});
