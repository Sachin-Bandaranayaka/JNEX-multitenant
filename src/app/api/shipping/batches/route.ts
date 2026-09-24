import { NextResponse } from 'next/server';
import { OrderStatus, ShippingProvider } from '@prisma/client';
import { z } from 'zod';
import { requireAnyPermission, requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { planBulkShipment } from '@/lib/billing/credits';
import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { transitionOrder } from '@/lib/order-workflow';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(100),
  provider: z.enum(['TRANS_EXPRESS', 'FARDA_EXPRESS', 'SL_POST']),
  trackingNumbers: z.record(z.string().trim().min(1)).optional(),
});

export async function GET() {
  const guard = await requirePermission('VIEW_SHIPPING');
  if (!guard.ok) return guard.response;
  const batches = await prisma.shipmentBatch.findMany({
    where: { tenantId: guard.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true } }, items: { include: { order: { select: { number: true, trackingNumber: true, status: true } } }, orderBy: { position: 'asc' } } },
  });
  return NextResponse.json(batches);
}

export async function POST(request: Request) {
  const guard = await requireAnyPermission(['UPDATE_SHIPPING_STATUS', 'EDIT_ORDERS']);
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Select orders and an active courier.' }, { status: 400 });
  const { provider, trackingNumbers } = parsed.data;
  const orderIds = [...new Set(parsed.data.orderIds)];
  const orders = await prisma.order.findMany({
    where: { tenantId: guard.tenantId, id: { in: orderIds } },
    select: { id: true, number: true, status: true, total: true, codAmount: true, customerName: true, customerAddress: true, customerPhone: true, customerSecondPhone: true, shippingLocationProvider: true, shippingCityId: true, shippedAt: true, trackingNumber: true, shipmentBatchItem: { select: { id: true } } },
  });
  if (orders.length !== orderIds.length) return NextResponse.json({ error: 'Some selected orders are unavailable.' }, { status: 404 });
  const byId = new Map(orders.map(order => [order.id, order]));
  const ordered = orderIds.map(id => byId.get(id)!);
  const invalid = ordered.filter(order => !['PENDING', 'CONFIRMED'].includes(order.status) || order.shippedAt || order.trackingNumber || order.shipmentBatchItem);
  if (invalid.length) return NextResponse.json({ error: `${invalid.length} selected order(s) are no longer ready to ship. Refresh and try again.` }, { status: 409 });
  if (provider !== 'TRANS_EXPRESS' && ordered.some(order => !trackingNumbers?.[order.id]?.trim())) {
    return NextResponse.json({ error: 'Enter a tracking number for every selected order.' }, { status: 400 });
  }

  const plan = await planBulkShipment(guard.tenantId, ordered.map(order => ({ orderId: order.id, orderTotal: order.total })));
  const allowed = new Set(plan.allowed);
  const errors: Array<{ orderId: string; number: number; error: string }> = plan.blocked.map(item => ({ orderId: item.orderId, number: byId.get(item.orderId)!.number, error: `Insufficient credit; needs ${item.required} credits.` }));
  let candidates = ordered.filter(order => allowed.has(order.id));
  const tracking = new Map<string, string>();

  if (provider === 'TRANS_EXPRESS' && candidates.length) {
    const tenant = await prisma.tenant.findUnique({ where: { id: guard.tenantId }, select: { transExpressApiKey: true, transExpressOrderPrefix: true } });
    if (!tenant?.transExpressApiKey) return NextResponse.json({ error: 'Configure the Trans Express API key before shipping.' }, { status: 400 });
    const withCity = candidates.filter(order => order.shippingLocationProvider === ShippingProvider.TRANS_EXPRESS && order.shippingCityId);
    for (const order of candidates.filter(order => !withCity.includes(order))) errors.push({ orderId: order.id, number: order.number, error: 'Select a Trans Express city on the order first.' });
    const date = new Date();
    const suffix = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getFullYear()).slice(-2)}`;
    const results = withCity.length ? await new TransExpressProvider(tenant.transExpressApiKey).createBulkShipmentsWithCityIds(withCity.map(order => ({
      orderId: order.id,
      orderNo: `${tenant.transExpressOrderPrefix || 'JNEX'}-${order.number}-${suffix}`,
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      cityId: order.shippingCityId!,
      customerPhone: order.customerPhone,
      customerSecondPhone: order.customerSecondPhone || undefined,
      orderTotal: order.codAmount ?? order.total,
    }))) : [];
    for (const result of results) {
      if (result.trackingNumber) tracking.set(result.orderId, result.trackingNumber);
      else errors.push({ orderId: result.orderId, number: byId.get(result.orderId)!.number, error: result.error || 'Courier did not return a tracking number.' });
    }
    candidates = withCity.filter(order => tracking.has(order.id));
  } else if (provider !== 'TRANS_EXPRESS') {
    for (const order of candidates) tracking.set(order.id, trackingNumbers![order.id].trim());
  }

  const shipped: string[] = [];
  for (const order of candidates) {
    try {
      await transitionOrder({ orderId: order.id, tenantId: guard.tenantId, userId: guard.session.user.id, to: OrderStatus.SHIPPED, source: 'shipment batch', shipping: { provider, trackingNumber: tracking.get(order.id)! } });
      shipped.push(order.id);
    } catch (error) {
      errors.push({ orderId: order.id, number: order.number, error: error instanceof Error ? error.message : 'Could not record shipment.' });
    }
  }
  if (!shipped.length) return NextResponse.json({ error: 'No orders were shipped.', errors }, { status: 422 });
  const batch = await prisma.shipmentBatch.create({ data: { tenantId: guard.tenantId, userId: guard.session.user.id, provider, items: { create: shipped.map((orderId, position) => ({ orderId, position })) } } });
  return NextResponse.json({ id: batch.id, shippedCount: shipped.length, errors }, { status: 201 });
}
