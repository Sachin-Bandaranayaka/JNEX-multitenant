import { OrderStatus, ShippingProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.RESCHEDULED],
  RESCHEDULED: [OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.CANCELLED],
  DELIVERED: [OrderStatus.RETURNED],
  RETURNED: [],
  CANCELLED: [],
};

export interface TransitionOrderInput {
  orderId: string;
  tenantId: string;
  userId: string;
  to: OrderStatus;
  occurredAt?: Date;
  source?: string;
  description?: string;
  shipping?: {
    provider: ShippingProvider;
    trackingNumber: string;
  };
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return from !== to && TRANSITIONS[from].includes(to);
}

/** The only place that changes an order lifecycle state and its inventory. */
export async function transitionOrder(input: TransitionOrderInput) {
  const at = input.occurredAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: input.orderId, tenantId: input.tenantId },
      include: { product: true },
    });
    if (!order) throw new Error('Order not found');
    if (!canTransition(order.status, input.to)) {
      throw new Error(`Cannot transition order from ${order.status} to ${input.to}`);
    }

    const update = await tx.order.updateMany({
      where: { id: order.id, tenantId: input.tenantId, status: order.status },
      data: {
        status: input.to,
        ...(input.to === OrderStatus.SHIPPED ? { shippedAt: at } : {}),
        ...(input.to === OrderStatus.DELIVERED ? { deliveredAt: at } : {}),
        ...(input.to === OrderStatus.RETURNED ? { deliveredAt: null } : {}),
        ...(input.shipping ? {
          shippingProvider: input.shipping.provider,
          trackingNumber: input.shipping.trackingNumber,
        } : {}),
      },
    });
    if (update.count !== 1) throw new Error('Order changed while it was being updated; please retry');

    const restoresStock = input.to === OrderStatus.RETURNED || input.to === OrderStatus.CANCELLED;
    if (restoresStock) {
      await tx.product.update({
        where: { id: order.productId },
        data: { stock: { increment: order.quantity } },
      });
      await tx.stockAdjustment.create({
        data: {
          productId: order.productId,
          userId: input.userId,
          tenantId: input.tenantId,
          quantity: order.quantity,
          previousStock: order.product.stock,
          newStock: order.product.stock + order.quantity,
          reason: input.description ?? `${input.to}: order ${order.id}${input.source ? ` (${input.source})` : ''}`,
        },
      });
    }

    await tx.orderStatusHistory.updateMany({
      where: { orderId: order.id, tenantId: input.tenantId, isCurrentStatus: true },
      data: { isCurrentStatus: false },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        tenantId: input.tenantId,
        status: input.to,
        statusCode: input.to,
        timestamp: at,
        isCurrentStatus: true,
        description: input.description ?? (input.source ? `Updated via ${input.source}` : 'Status updated'),
      },
    });

    if (input.to === OrderStatus.DELIVERED || input.to === OrderStatus.RETURNED) {
      await tx.notification.create({
        data: {
          tenantId: input.tenantId,
          orderId: order.id,
          title: input.to === OrderStatus.DELIVERED ? 'Order Delivered' : 'Order Returned',
          description: `Order #${order.number} marked as ${input.to.toLowerCase()}.`,
          type: input.to === OrderStatus.DELIVERED ? 'DELIVERY' : 'RETURN',
        },
      });
    }

    return tx.order.findFirstOrThrow({ where: { id: order.id, tenantId: input.tenantId }, include: { product: true } });
  }, { timeout: 15000 });
}
