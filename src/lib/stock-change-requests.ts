import { z } from 'zod';
import { prisma } from './prisma';
export const stockRequestSchema = z.object({
  productId: z.string().uuid(), kind: z.enum(['ADJUSTMENT', 'WASTE']),
  quantity: z.number().int().min(-100000).max(100000).refine(value => value !== 0, 'Quantity cannot be zero.'),
  reason: z.string().trim().min(3).max(500),
}).refine(value => value.kind !== 'WASTE' || value.quantity < 0, 'Waste quantity must reduce stock.');
export class StockRequestError extends Error { constructor(message: string, public status = 409) { super(message); } }
export async function createStockRequest(tenantId: string, actorId: string, raw: unknown) {
  const input = stockRequestSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const product = await tx.product.findFirst({ where: { id: input.productId, tenantId, isActive: true } });
    if (!product) throw new StockRequestError('Product is unavailable.', 404);
    const request = await tx.stockChangeRequest.create({ data: { ...input, tenantId, requestedById: actorId } });
    await tx.auditEvent.create({ data: { tenantId, actorId, action: 'STOCK_CHANGE_REQUESTED', entityType: 'StockChangeRequest', entityId: request.id, metadata: { productId: product.id, kind: input.kind, quantity: input.quantity, reason: input.reason } } });
    return request;
  });
}
export async function reviewStockRequest(requestId: string, actorId: string, decision: 'APPROVED' | 'REJECTED', reviewNote: string) {
  return prisma.$transaction(async tx => {
    const request = await tx.stockChangeRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new StockRequestError('Request not found.', 404);
    if (request.status !== 'PENDING') throw new StockRequestError('This request has already been reviewed.');
    const claimed = await tx.stockChangeRequest.updateMany({ where: { id: requestId, status: 'PENDING' }, data: { status: decision, reviewedById: actorId, reviewNote, reviewedAt: new Date() } });
    if (claimed.count !== 1) throw new StockRequestError('Another reviewer has already handled this request.');
    let movementId: string | undefined;
    if (decision === 'APPROVED') {
      const product = await tx.product.findFirst({ where: { id: request.productId, tenantId: request.tenantId, isActive: true } });
      if (!product) throw new StockRequestError('Product is unavailable.');
      const newStock = product.stock + request.quantity;
      if (newStock < 0) throw new StockRequestError('Insufficient stock. The request remains pending.');
      const changed = await tx.product.updateMany({ where: { id: product.id, tenantId: request.tenantId, stock: product.stock, isActive: true }, data: { stock: { increment: request.quantity } } });
      if (changed.count !== 1) throw new StockRequestError('Stock changed while reviewing. Retry using the current balance.');
      const movement = await tx.stockAdjustment.create({ data: { tenantId: request.tenantId, productId: product.id, userId: actorId, quantity: request.quantity, previousStock: product.stock, newStock, reason: `${request.kind}: ${request.reason}` } });
      movementId = movement.id;
      await tx.stockChangeRequest.update({ where: { id: requestId }, data: { stockAdjustmentId: movementId } });
    }
    await tx.auditEvent.create({ data: { tenantId: request.tenantId, actorId, action: `STOCK_CHANGE_${decision}`, entityType: 'StockChangeRequest', entityId: requestId, metadata: { productId: request.productId, quantity: request.quantity, kind: request.kind, reviewNote, stockAdjustmentId: movementId ?? null } } });
    return { id: requestId, status: decision };
  });
}
