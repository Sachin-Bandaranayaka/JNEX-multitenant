import { BillingMode, OrderStatus, ShippingProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { accrueDeliveryCharge, reverseDeliveryCharge } from '@/lib/billing/charges';
import { captureForDelivery, holdForShipment, refundCapture, releaseHold } from '@/lib/billing/credits';

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
  /**
   * Set false when the shipment already happened in the real world and we are
   * only catching up — courier polling, reconciliation, backfills. The credit
   * hold is still recorded, but an under-funded tenant is not blocked, because
   * there is nothing left to block. Defaults to true.
   */
  enforceCredit?: boolean;
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
      include: { product: true, tenant: { select: { billingMode: true } } },
    });
    if (!order) throw new Error('Order not found');
    if (!canTransition(order.status, input.to)) {
      throw new Error(`Cannot transition order from ${order.status} to ${input.to}`);
    }

    const billingMode = order.tenant.billingMode;

    // A prepaid tenant reserves the fee before the shipment is allowed to
    // leave. This is the only billing check in the codebase that may abort what
    // the user was doing, and it runs before the write so an under-funded
    // tenant never gets a SHIPPED order recorded at all.
    if (input.to === OrderStatus.SHIPPED && billingMode === BillingMode.PREPAID) {
      await holdForShipment(tx, {
        tenantId: input.tenantId,
        orderId: order.id,
        orderTotal: order.total,
        at,
        billingMode,
        allowOverdraft: input.enforceCredit === false,
      });
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

    // Platform billing rides on the same transaction as the status change, so
    // a delivery is never recorded without its fee and a fee never exists for
    // an order that did not deliver. Accrual is idempotent on orderId.
    if (input.to === OrderStatus.DELIVERED) {
      await accrueDeliveryCharge(tx, {
        tenantId: input.tenantId,
        orderId: order.id,
        orderTotal: order.total,
        deliveredAt: at,
      });
      // Settles the ship-time hold against the real fee and marks the charge
      // PAID, so a prepaid tenant is never invoiced for money already taken
      // from their wallet. Never blocks: a delivery is a fact, not a request.
      await captureForDelivery(tx, { tenantId: input.tenantId, orderId: order.id, at, billingMode });
    } else if (input.to === OrderStatus.RETURNED && order.status === OrderStatus.DELIVERED) {
      const reason = input.description ?? `Returned after delivery${input.source ? ` (${input.source})` : ''}`;
      await reverseDeliveryCharge(tx, { orderId: order.id, reason, at });
      await refundCapture(tx, { orderId: order.id, reason });
    } else if (input.to === OrderStatus.RETURNED || input.to === OrderStatus.CANCELLED) {
      // Left SHIPPED without delivering, so the reservation is given back. A
      // no-op when there was no hold, which is every postpaid order.
      await releaseHold(tx, {
        orderId: order.id,
        reason: input.description ?? `Hold released on ${input.to.toLowerCase()}`,
      });
    }

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
