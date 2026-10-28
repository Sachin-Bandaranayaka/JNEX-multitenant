import { NextResponse } from 'next/server';
import { OrderStatus, Prisma, ShippingProvider } from '@prisma/client';
import { z } from 'zod';
import { requireAnyPermission, requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { planBulkShipment } from '@/lib/billing/credits';
import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { transitionOrder } from '@/lib/order-workflow';

export const dynamic = 'force-dynamic';

// A batch item is the claim on an order while it is being booked. A claim with
// no waybill this old belongs to a request that died before booking, so it can
// be taken over. Long enough for a 100-order batch sent in small chunks.
const CLAIM_TTL_MS = 15 * 60 * 1000;

const schema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(100),
  provider: z.enum(['TRANS_EXPRESS', 'FARDA_EXPRESS', 'SL_POST']),
  trackingNumbers: z.record(z.string().trim().min(1)).optional(),
  // Set when the client sends a large selection in chunks, so every chunk
  // lands in the batch the first one created.
  batchId: z.string().min(1).optional(),
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

/**
 * Books and records a set of orders as one shipment batch.
 *
 * Safe to retry: orders are claimed before the courier is called, and each
 * waybill is saved the moment the courier returns it. A request that dies
 * part-way leaves booked orders holding their waybill, and sending them again
 * records them without booking a second parcel.
 */
export async function POST(request: Request) {
  const guard = await requireAnyPermission(['UPDATE_SHIPPING_STATUS', 'EDIT_ORDERS']);
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Select orders and an active courier.' }, { status: 400 });
  const { provider, trackingNumbers } = parsed.data;
  const tenantId = guard.tenantId;
  const userId = guard.session.user.id;
  const orderIds = [...new Set(parsed.data.orderIds)];
  const orders = await prisma.order.findMany({
    where: { tenantId, id: { in: orderIds } },
    select: { id: true, number: true, orderCode: true, status: true, total: true, codAmount: true, customerName: true, customerAddress: true, customerPhone: true, customerSecondPhone: true, shippingLocationProvider: true, shippingCityId: true, shippingProvider: true, shippedAt: true, trackingNumber: true, shipmentBatchItem: { select: { id: true, batchId: true, batch: { select: { createdAt: true } } } } },
  });
  if (orders.length !== orderIds.length) return NextResponse.json({ error: 'Some selected orders are unavailable.' }, { status: 404 });

  let batchId = parsed.data.batchId;
  if (batchId && !(await prisma.shipmentBatch.findFirst({ where: { id: batchId, tenantId, userId, provider }, select: { id: true } }))) {
    return NextResponse.json({ error: 'That shipment batch is no longer available. Start a new one.' }, { status: 404 });
  }

  const byId = new Map(orders.map(order => [order.id, order]));
  const ordered = orderIds.map(id => byId.get(id)!);
  type ReadyOrder = (typeof ordered)[number];
  const errors: Array<{ orderId: string; number: number; error: string }> = [];
  const fail = (order: ReadyOrder, error: string) => errors.push({ orderId: order.id, number: order.number, error });

  // Booked by an earlier attempt that never finished recording: record only.
  let resume: ReadyOrder[] = [];
  let fresh: ReadyOrder[] = [];
  const staleClaims: string[] = [];
  for (const order of ordered) {
    const claim = order.shipmentBatchItem;
    if (order.shippedAt || !['PENDING', 'CONFIRMED'].includes(order.status)) fail(order, 'Already shipped or no longer ready to ship.');
    else if (order.trackingNumber) {
      if (!claim) fail(order, 'Already has a tracking number. Update it from the order page.');
      else if (order.shippingProvider !== provider) fail(order, `Already booked with ${order.shippingProvider?.replaceAll('_', ' ') ?? 'another courier'}. Ship it with that courier to finish.`);
      else resume.push(order);
    } else if (claim && claim.batchId !== batchId && Date.now() - claim.batch.createdAt.getTime() < CLAIM_TTL_MS) {
      fail(order, 'Another shipment for this order is still in progress. Wait a minute, then refresh.');
    } else {
      if (claim) staleClaims.push(claim.id);
      fresh.push(order);
    }
  }
  if (provider !== 'TRANS_EXPRESS' && fresh.some(order => !trackingNumbers?.[order.id]?.trim())) {
    return NextResponse.json({ error: 'Enter a tracking number for every selected order.' }, { status: 400 });
  }

  const plan = await planBulkShipment(tenantId, [...resume, ...fresh].map(order => ({ orderId: order.id, orderTotal: order.total })));
  const allowed = new Set(plan.allowed);
  for (const item of plan.blocked) fail(byId.get(item.orderId)!, `Insufficient credit; needs ${item.required} credits.`);
  resume = resume.filter(order => allowed.has(order.id));
  fresh = fresh.filter(order => allowed.has(order.id));

  let transExpress: TransExpressProvider | null = null;
  let orderNoPrefix = 'JNEX';
  if (provider === 'TRANS_EXPRESS' && fresh.length) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { transExpressApiKey: true, transExpressOrderPrefix: true } });
    if (!tenant?.transExpressApiKey) return NextResponse.json({ error: 'Configure the Trans Express API key before shipping.' }, { status: 400 });
    transExpress = new TransExpressProvider(tenant.transExpressApiKey);
    orderNoPrefix = tenant.transExpressOrderPrefix || orderNoPrefix;
    for (const order of fresh.filter(order => order.shippingLocationProvider !== ShippingProvider.TRANS_EXPRESS || !order.shippingCityId)) fail(order, 'Select a Trans Express city on the order first.');
    fresh = fresh.filter(order => order.shippingLocationProvider === ShippingProvider.TRANS_EXPRESS && order.shippingCityId);
  }
  if (!resume.length && !fresh.length) return NextResponse.json({ id: batchId ?? null, error: 'No orders were shipped.', shippedCount: 0, errors }, { status: 422 });

  // Claim before booking. The unique orderId on batch items means a second
  // request for the same order cannot claim it, so it never reaches the courier.
  const createdBatch = !batchId;
  if (!batchId) batchId = (await prisma.shipmentBatch.create({ data: { tenantId, userId, provider }, select: { id: true } })).id;
  if (staleClaims.length) await prisma.shipmentBatchItem.deleteMany({ where: { id: { in: staleClaims }, order: { trackingNumber: null } } });
  const last = await prisma.shipmentBatchItem.aggregate({ where: { batchId }, _max: { position: true } });
  let position = (last._max.position ?? -1) + 1;
  await prisma.shipmentBatchItem.createMany({ data: fresh.map(order => ({ batchId: batchId!, orderId: order.id, position: position++ })), skipDuplicates: true });
  const claimed = new Set((await prisma.shipmentBatchItem.findMany({ where: { batchId, orderId: { in: fresh.map(order => order.id) } }, select: { orderId: true } })).map(item => item.orderId));
  for (const order of fresh.filter(order => !claimed.has(order.id))) fail(order, 'Another shipment for this order is still in progress. Wait a minute, then refresh.');
  fresh = fresh.filter(order => claimed.has(order.id));
  // A resumed order joins this batch so it prints with the rest.
  for (const order of resume) await prisma.shipmentBatchItem.update({ where: { orderId: order.id }, data: { batchId, position: position++ } });

  const waybills = new Map<string, string>();
  if (transExpress && fresh.length) {
    const date = new Date();
    const suffix = `${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getFullYear()).slice(-2)}`;
    const results = await transExpress.createBulkShipmentsWithCityIds(fresh.map(order => ({
      orderId: order.id,
      orderNo: order.orderCode || `${orderNoPrefix}-${order.number}-${suffix}`,
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      cityId: order.shippingCityId!,
      customerPhone: order.customerPhone,
      customerSecondPhone: order.customerSecondPhone || undefined,
      orderTotal: order.codAmount ?? order.total,
    })));
    for (const result of results) {
      if (result.trackingNumber) waybills.set(result.orderId, result.trackingNumber);
      else fail(byId.get(result.orderId)!, result.error || 'Courier did not return a tracking number.');
    }
  } else if (provider !== 'TRANS_EXPRESS') {
    for (const order of fresh) waybills.set(order.id, trackingNumbers![order.id].trim());
  }

  // Save every waybill in one round trip before the slow per-order recording,
  // so a request that dies from here on can be finished by a retry.
  if (waybills.size) {
    const rows = [...waybills].map(([orderId, waybill]) => Prisma.sql`(${orderId}, ${waybill})`);
    await prisma.$executeRaw`UPDATE "Order" AS o SET "trackingNumber" = v.tracking, "shippingProvider" = ${provider}::"ShippingProvider", "updatedAt" = now() FROM (VALUES ${Prisma.join(rows)}) AS v(id, tracking) WHERE o.id = v.id AND o."tenantId" = ${tenantId} AND o."trackingNumber" IS NULL`;
  }
  const unbooked = fresh.filter(order => !waybills.has(order.id)).map(order => order.id);
  if (unbooked.length) await prisma.shipmentBatchItem.deleteMany({ where: { batchId, orderId: { in: unbooked } } });

  const toRecord = [...resume.map(order => [order, order.trackingNumber!] as const), ...fresh.filter(order => waybills.has(order.id)).map(order => [order, waybills.get(order.id)!] as const)];
  const shipped: string[] = [];
  for (const [order, waybill] of toRecord) {
    try {
      await transitionOrder({ orderId: order.id, tenantId, userId, to: OrderStatus.SHIPPED, source: 'shipment batch', shipping: { provider, trackingNumber: waybill } });
      shipped.push(order.id);
    } catch (error) {
      // The waybill and claim stay, so shipping it again records it without a second booking.
      fail(order, `Booked as ${waybill} but not recorded: ${error instanceof Error ? error.message : 'unknown error'} Ship it again to finish; it will not be booked twice.`);
    }
  }

  if (createdBatch && !toRecord.length) await prisma.shipmentBatch.delete({ where: { id: batchId } });
  const id = createdBatch && !toRecord.length ? null : batchId;
  if (!shipped.length) return NextResponse.json({ id, error: 'No orders were shipped.', shippedCount: 0, errors }, { status: 422 });
  return NextResponse.json({ id, shippedCount: shipped.length, errors }, { status: 201 });
}
