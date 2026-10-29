import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyPermission } from '@/lib/authz';
import { shipBatch } from '@/lib/shipping/ship-batch';

export const dynamic = 'force-dynamic';

// The Orders-page Bulk Ship modal. It goes through the same claim-first batch
// flow as the Ship page, so a double click or a retry cannot book an order twice,
// and its shipments appear in the Shipped List like any other batch.
const schema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(100).optional(),
  orders: z.array(z.object({ orderId: z.string().min(1), cityId: z.number().int().positive().optional(), weight: z.number().positive().optional() })).min(1).max(100).optional(),
  weight: z.number().positive().optional(),
  batchId: z.string().min(1).optional(),
  confirmedUnbooked: z.array(z.string().min(1)).optional(),
});

export async function POST(request: Request) {
  const guard = await requireAnyPermission(['UPDATE_SHIPPING_STATUS', 'EDIT_ORDERS']);
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const orderIds = parsed.success ? parsed.data.orders?.map(order => order.orderId) ?? parsed.data.orderIds : undefined;
  if (!parsed.success || !orderIds?.length) return NextResponse.json({ error: 'orderIds or orders array must be provided' }, { status: 400 });

  const result = await shipBatch({
    tenantId: guard.tenantId,
    userId: guard.session.user.id,
    provider: 'TRANS_EXPRESS',
    orderIds,
    overrides: Object.fromEntries((parsed.data.orders ?? []).map(order => [order.orderId, { cityId: order.cityId, weight: order.weight }])),
    weight: parsed.data.weight,
    batchId: parsed.data.batchId,
    confirmedUnbooked: parsed.data.confirmedUnbooked,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    id: result.id,
    results: [
      ...result.shipped.map(item => ({ orderId: item.orderId, orderNo: `#${item.number}`, trackingNumber: item.trackingNumber })),
      ...result.errors.map(item => ({ orderId: item.orderId, orderNo: `#${item.number}`, error: item.error, code: item.code })),
    ],
  });
}
