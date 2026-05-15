// src/app/api/orders/bulk-update/apply/route.ts
// Applies a confirmed list of order status updates from the bulk-update preview.
// Each update is a small transaction so a single bad row never poisons the batch.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient } from '@/lib/prisma';
import { createNotification } from '@/lib/notifications';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const applySchema = z.object({
  updates: z
    .array(
      z.object({
        orderId: z.string().min(1),
        newStatus: z.enum(['DELIVERED', 'RETURNED', 'CANCELLED']),
        statusChangeDate: z.string().nullable().optional(),
        sourceWaybill: z.string().optional(),
      })
    )
    .min(1)
    .max(5000),
});

// Same allow-list as the preview route; we re-enforce here so a malicious
// client can't bypass the safe-transition check.
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.CANCELLED],
  [OrderStatus.RESCHEDULED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.CANCELLED]: [],
};

function isAllowed(from: OrderStatus, to: OrderStatus) {
  if (from === to) return false;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

interface UpdateResult {
  orderId: string;
  success: boolean;
  previousStatus?: OrderStatus;
  newStatus?: OrderStatus;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const tenantId = session.user.tenantId;
    const userId = session.user.id;
    const prisma = getScopedPrismaClient(tenantId);
    const { updates } = parsed.data;

    const results: UpdateResult[] = [];
    let delivered = 0;
    let returned = 0;
    let cancelled = 0;

    // Process sequentially. We do small per-order transactions instead of one
    // huge transaction so partial failures don't roll back the entire batch.
    for (const u of updates) {
      try {
        const order = await prisma.order.findUnique({
          where: { id: u.orderId },
          include: { product: true },
        });

        if (!order) {
          results.push({ orderId: u.orderId, success: false, error: 'Order not found' });
          continue;
        }

        const current = order.status as OrderStatus;
        const target = u.newStatus as OrderStatus;

        if (!isAllowed(current, target)) {
          results.push({
            orderId: u.orderId,
            success: false,
            previousStatus: current,
            error: `Cannot transition from ${current} to ${target}`,
          });
          continue;
        }

        const statusChangeDate =
          u.statusChangeDate && !isNaN(new Date(u.statusChangeDate).getTime())
            ? new Date(u.statusChangeDate)
            : new Date();

        // Single atomic transaction per order. Handles stock restoration when
        // marking RETURNED, and resets deliveredAt as appropriate.
        await prisma.$transaction(async (tx) => {
          const updateData: Record<string, any> = {
            status: target,
            updatedAt: new Date(),
          };

          if (target === OrderStatus.DELIVERED) {
            updateData.deliveredAt = statusChangeDate;
          } else if (target === OrderStatus.RETURNED) {
            // RETURNED resets deliveredAt — the order isn't "delivered" anymore.
            updateData.deliveredAt = null;
          }

          await tx.order.update({
            where: { id: order.id },
            data: updateData,
          });

          // Audit trail: record this change in TrackingUpdate so it shows up
          // in the order timeline.
          await tx.trackingUpdate.create({
            data: {
              orderId: order.id,
              status: target,
              timestamp: statusChangeDate,
              tenantId,
            },
          });

          // For RETURNED, restore stock and create an adjustment record —
          // mirrors the existing logic in /api/orders/sync-tracking.
          if (target === OrderStatus.RETURNED) {
            await tx.product.update({
              where: { id: order.product.id },
              data: { stock: { increment: order.quantity } },
            });
            await tx.stockAdjustment.create({
              data: {
                productId: order.product.id,
                quantity: order.quantity,
                reason: `Bulk update: returned (waybill ${u.sourceWaybill ?? order.trackingNumber ?? '—'})`,
                previousStock: order.product.stock,
                newStock: order.product.stock + order.quantity,
                userId,
                tenantId,
              },
            });
          }

          // For CANCELLED from a non-shipped state, restore stock too.
          const cancelStockExempt: OrderStatus[] = [
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
            OrderStatus.RETURNED,
          ];
          if (target === OrderStatus.CANCELLED && !cancelStockExempt.includes(current)) {
            await tx.product.update({
              where: { id: order.product.id },
              data: { stock: { increment: order.quantity } },
            });
            await tx.stockAdjustment.create({
              data: {
                productId: order.product.id,
                quantity: order.quantity,
                reason: `Bulk update: cancelled (waybill ${u.sourceWaybill ?? order.trackingNumber ?? '—'})`,
                previousStock: order.product.stock,
                newStock: order.product.stock + order.quantity,
                userId,
                tenantId,
              },
            });
          }
        }, { timeout: 15000 });

        // Notification — outside the transaction so a notification failure
        // doesn't roll back the order update.
        try {
          if (target === OrderStatus.DELIVERED) {
            await createNotification(
              tenantId,
              'Order Delivered',
              `Order #${order.number} marked as delivered (bulk update from courier file).`,
              'DELIVERY',
              order.id
            );
            delivered++;
          } else if (target === OrderStatus.RETURNED) {
            await createNotification(
              tenantId,
              'Order Returned',
              `Order #${order.number} marked as returned (bulk update). Stock restored.`,
              'RETURN',
              order.id
            );
            returned++;
          } else if (target === OrderStatus.CANCELLED) {
            cancelled++;
          }
        } catch (notifyErr) {
          console.error('Notification failed (non-fatal):', notifyErr);
        }

        results.push({
          orderId: order.id,
          success: true,
          previousStatus: current,
          newStatus: target,
        });
      } catch (err) {
        console.error(`Bulk update: order ${u.orderId} failed:`, err);
        results.push({
          orderId: u.orderId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: failureCount === 0,
      processed: results.length,
      successCount,
      failureCount,
      summary: { delivered, returned, cancelled },
      results,
    });
  } catch (error) {
    console.error('Bulk update apply error:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply bulk update',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
