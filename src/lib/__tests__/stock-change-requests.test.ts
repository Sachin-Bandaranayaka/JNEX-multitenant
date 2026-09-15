import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStockRequest, reviewStockRequest, stockRequestSchema } from '../stock-change-requests';
const mocks = vi.hoisted(() => ({ product: { findFirst: vi.fn(), updateMany: vi.fn() }, request: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() }, movement: vi.fn(), audit: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: (callback: any) => callback({ product: mocks.product, stockChangeRequest: mocks.request, stockAdjustment: { create: mocks.movement }, auditEvent: { create: mocks.audit } }) } }));
const productId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.product.findFirst.mockResolvedValue({ id: productId, stock: 10 });
  mocks.product.updateMany.mockResolvedValue({ count: 1 });
  mocks.request.create.mockResolvedValue({ id: 'request-a' });
  mocks.request.findUnique.mockResolvedValue({ id: 'request-a', tenantId: 'tenant-a', productId, status: 'PENDING', quantity: -3, kind: 'WASTE', reason: 'Damaged' });
  mocks.request.updateMany.mockResolvedValue({ count: 1 });
  mocks.movement.mockResolvedValue({ id: 'movement-a' });
});
describe('stock approval workflow', () => {
  it('creates a tenant-scoped request without changing stock', async () => {
    await createStockRequest('tenant-a', 'staff-a', { productId, quantity: -3, kind: 'WASTE', reason: 'Damaged' });
    expect(mocks.product.findFirst).toHaveBeenCalledWith({ where: { id: productId, tenantId: 'tenant-a', isActive: true } });
    expect(mocks.product.updateMany).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalled();
  });
  it('rejects waste increases and zero movements', () => {
    expect(stockRequestSchema.safeParse({ productId, quantity: 3, kind: 'WASTE', reason: 'Damaged' }).success).toBe(false);
    expect(stockRequestSchema.safeParse({ productId, quantity: 0, kind: 'ADJUSTMENT', reason: 'Count' }).success).toBe(false);
  });
  it('claims approval once and records the before/after movement', async () => {
    await reviewStockRequest('request-a', 'admin-a', 'APPROVED', 'Verified');
    expect(mocks.request.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'request-a', status: 'PENDING' } }));
    expect(mocks.product.updateMany).toHaveBeenCalledWith({ where: { id: productId, tenantId: 'tenant-a', stock: 10, isActive: true }, data: { stock: { increment: -3 } } });
    expect(mocks.movement).toHaveBeenCalledWith({ data: { tenantId: 'tenant-a', productId, userId: 'admin-a', quantity: -3, previousStock: 10, newStock: 7, reason: 'WASTE: Damaged' } });
  });
  it('rejection does not create a stock movement', async () => {
    await reviewStockRequest('request-a', 'admin-a', 'REJECTED', 'Incorrect');
    expect(mocks.product.updateMany).not.toHaveBeenCalled(); expect(mocks.movement).not.toHaveBeenCalled();
  });
  it('stops repeat and simultaneous approvals', async () => {
    mocks.request.updateMany.mockResolvedValue({ count: 0 });
    await expect(reviewStockRequest('request-a', 'admin-a', 'APPROVED', 'Verified')).rejects.toThrow('already handled');
    expect(mocks.product.updateMany).not.toHaveBeenCalled();
  });
  it('rejects insufficient or concurrently changed stock', async () => {
    mocks.product.findFirst.mockResolvedValue({ id: productId, stock: 2 });
    await expect(reviewStockRequest('request-a', 'admin-a', 'APPROVED', 'Verified')).rejects.toThrow('Insufficient stock');
    mocks.product.findFirst.mockResolvedValue({ id: productId, stock: 10 }); mocks.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(reviewStockRequest('request-a', 'admin-a', 'APPROVED', 'Verified')).rejects.toThrow('Stock changed');
    expect(mocks.movement).not.toHaveBeenCalled();
  });
  it('propagates audit failure to roll back the transaction', async () => {
    mocks.audit.mockRejectedValue(new Error('Audit unavailable'));
    await expect(reviewStockRequest('request-a', 'admin-a', 'APPROVED', 'Verified')).rejects.toThrow('Audit unavailable');
  });
});
