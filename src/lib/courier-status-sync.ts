// src/lib/courier-status-sync.ts
//
// One place that translates "what the courier says" into "what the order
// becomes".
//
// Several routes poll courier APIs — the hourly cron, the manual sync, and the
// per-order tracking views a user can open at any time. Each of them used to
// write `order.status` itself, with variations of
//   status: delivered ? 'DELIVERED' : 'SHIPPED', deliveredAt: delivered ? now : null
// which quietly resurrected returned orders, skipped stock restoration, and —
// once platform billing exists — would have delivered orders that were never
// billed. They all come through here instead.

import { OrderStatus } from '@prisma/client';
import { ShipmentStatus } from '@/lib/shipping/types';
import { canTransition, transitionOrder } from '@/lib/order-workflow';

export const COURIER_STATUS_MAP: Record<ShipmentStatus, OrderStatus> = {
  [ShipmentStatus.PENDING]: OrderStatus.SHIPPED,
  [ShipmentStatus.IN_TRANSIT]: OrderStatus.SHIPPED,
  [ShipmentStatus.OUT_FOR_DELIVERY]: OrderStatus.SHIPPED,
  [ShipmentStatus.DELIVERED]: OrderStatus.DELIVERED,
  [ShipmentStatus.RETURNED]: OrderStatus.RETURNED,
  [ShipmentStatus.EXCEPTION]: OrderStatus.SHIPPED,
  [ShipmentStatus.RESCHEDULED]: OrderStatus.RESCHEDULED,
};

export interface CourierStatusOrder {
  id: string;
  status: OrderStatus;
  tenantId: string;
  /** The order's assignee — stock movements are attributed to them by default. */
  userId: string;
  trackingNumber?: string | null;
}

export type CourierStatusResult = {
  changed: boolean;
  newStatus?: OrderStatus;
  /** Why nothing happened, when nothing happened. */
  skipped?: string;
};

/**
 * Applies a courier-reported shipment status to an order.
 *
 * Deliberately conservative: a status the state machine does not allow from the
 * order's current state is reported back as skipped rather than forced. A
 * courier still reporting "in transit" for an order an operator already marked
 * returned should not undo the operator.
 */
export async function applyCourierStatus(
  order: CourierStatusOrder,
  shipmentStatus: ShipmentStatus,
  source: string,
  actorUserId?: string,
): Promise<CourierStatusResult> {
  const target = COURIER_STATUS_MAP[shipmentStatus];
  if (!target) return { changed: false, skipped: `unrecognised courier status ${shipmentStatus}` };
  if (target === order.status) return { changed: false, skipped: 'no status change' };
  if (!canTransition(order.status, target)) {
    return { changed: false, skipped: `cannot move ${order.status} → ${target}` };
  }

  await transitionOrder({
    orderId: order.id,
    tenantId: order.tenantId,
    userId: actorUserId ?? order.userId,
    to: target,
    source,
    // The courier is reporting what already happened. Credit is still reserved
    // so the ledger stays complete, but a short balance cannot stop us from
    // recording the truth about where a parcel is.
    enforceCredit: false,
    description: `${source} reported ${shipmentStatus}${order.trackingNumber ? ` (${order.trackingNumber})` : ''}`,
  });

  return { changed: true, newStatus: target };
}
