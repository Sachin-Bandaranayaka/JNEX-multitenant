import { OrderStatus, Prisma, ShippingProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { planBulkShipment } from '@/lib/billing/credits';
import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { transitionOrder } from '@/lib/order-workflow';

// A batch item is the claim on an order while it is being booked. Within this
// window a claim with no waybill may belong to a request that is still talking
// to the courier, so nobody else may touch it.
const CLAIM_IN_PROGRESS_MS = 5 * 60 * 1000;

export type BatchProvider = 'TRANS_EXPRESS' | 'FARDA_EXPRESS' | 'SL_POST';
export type ShipBatchError = {
  orderId: string;
  number: number;
  error: string;
  /**
   * An earlier attempt stopped while booking, and the courier offers no way to
   * look the order up, so it may or may not be booked. Sending the order again
   * in `confirmedUnbooked` (after checking the courier portal) books it.
   */
  code?: 'BOOKING_UNCONFIRMED';
};
export type ShipBatchInput = {
  tenantId: string;
  userId: string;
  provider: BatchProvider;
  orderIds: string[];
  trackingNumbers?: Record<string, string>;
  /** Set when a large selection is sent in chunks, so every chunk joins one batch. */
  batchId?: string;
  /** Trans Express city and weight chosen at ship time, for orders without a saved location. */
  overrides?: Record<string, { cityId?: number; weight?: number }>;
  weight?: number;
  /** Orders whose unconfirmed booking a person checked and found missing at the courier. */
  confirmedUnbooked?: string[];
};
export type ShipBatchResult =
  | { ok: true; id: string | null; shipped: Array<{ orderId: string; number: number; trackingNumber: string }>; errors: ShipBatchError[] }
  | { ok: false; status: number; error: string };

/**
 * Books and records a set of orders as one shipment batch.
 *
 * Safe to retry: orders are claimed before the courier is called, and each
 * waybill is saved the moment the courier returns it. A request that dies
 * part-way leaves booked orders holding their waybill, and sending them again
 * records them without booking a second parcel. A claim with no waybill is
 * never re-booked on a guess; a person has to confirm it.
 */
export async function shipBatch(input: ShipBatchInput): Promise<ShipBatchResult> {
  const { tenantId, userId, provider, trackingNumbers, overrides = {} } = input;
  const confirmedUnbooked = new Set(input.confirmedUnbooked ?? []);
  const orderIds = [...new Set(input.orderIds)];
  const orders = await prisma.order.findMany({
    where: { tenantId, id: { in: orderIds } },
    select: { id: true, number: true, orderCode: true, status: true, total: true, codAmount: true, customerName: true, customerAddress: true, customerPhone: true, customerSecondPhone: true, shippingLocationProvider: true, shippingCityId: true, shippingProvider: true, shippedAt: true, trackingNumber: true, shipmentBatchItem: { select: { id: true, batchId: true, batch: { select: { createdAt: true } } } } },
  });
  if (orders.length !== orderIds.length) return { ok: false, status: 404, error: 'Some selected orders are unavailable.' };

  let batchId = input.batchId;
  if (batchId && !(await prisma.shipmentBatch.findFirst({ where: { id: batchId, tenantId, userId, provider }, select: { id: true } }))) {
    return { ok: false, status: 404, error: 'That shipment batch is no longer available. Start a new one.' };
  }

  const byId = new Map(orders.map(order => [order.id, order]));
  const ordered = orderIds.map(id => byId.get(id)!);
  type ReadyOrder = (typeof ordered)[number];
  const errors: ShipBatchError[] = [];
  const fail = (order: ReadyOrder, error: string, code?: ShipBatchError['code']) => errors.push({ orderId: order.id, number: order.number, error, ...(code ? { code } : {}) });
  const cityId = (order: ReadyOrder) => overrides[order.id]?.cityId || (order.shippingLocationProvider === ShippingProvider.TRANS_EXPRESS ? order.shippingCityId : null);
  const orderNo = (order: ReadyOrder, prefix: string) => {
    const date = new Date();
    return order.orderCode || `${prefix}-${order.number}-${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getFullYear()).slice(-2)}`;
  };

  // Booked by an earlier attempt that never finished recording: record only.
  let resume: ReadyOrder[] = [];
  let fresh: ReadyOrder[] = [];
  const takenOver: string[] = [];
  for (const order of ordered) {
    const claim = order.shipmentBatchItem;
    if (order.shippedAt || !['PENDING', 'CONFIRMED'].includes(order.status)) fail(order, 'Already shipped or no longer ready to ship.');
    else if (order.trackingNumber) {
      if (!claim) fail(order, 'Already has a tracking number. Update it from the order page.');
      else if (order.shippingProvider !== provider) fail(order, `Already booked with ${order.shippingProvider?.replaceAll('_', ' ') ?? 'another courier'}. Ship it with that courier to finish.`);
      else resume.push(order);
    } else if (claim && claim.batchId !== batchId) {
      if (Date.now() - claim.batch.createdAt.getTime() < CLAIM_IN_PROGRESS_MS) fail(order, 'Another shipment for this order is still in progress. Wait a minute, then refresh.');
      else if (!confirmedUnbooked.has(order.id)) fail(order, `An earlier attempt stopped while booking this order, so it may already be with ${provider.replaceAll('_', ' ')}. Check their portal for ${order.orderCode ? `order no. ${order.orderCode}` : `order #${order.number}`}; if it is not there, confirm and ship it again.`, 'BOOKING_UNCONFIRMED');
      else { takenOver.push(claim.id); fresh.push(order); }
    } else fresh.push(order);
  }
  if (provider !== 'TRANS_EXPRESS' && fresh.some(order => !trackingNumbers?.[order.id]?.trim())) {
    return { ok: false, status: 400, error: 'Enter a tracking number for every selected order.' };
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
    if (!tenant?.transExpressApiKey) return { ok: false, status: 400, error: 'Configure the Trans Express API key before shipping.' };
    transExpress = new TransExpressProvider(tenant.transExpressApiKey);
    orderNoPrefix = tenant.transExpressOrderPrefix || orderNoPrefix;
    for (const order of fresh.filter(order => !cityId(order))) fail(order, 'Select a Trans Express city on the order first.');
    fresh = fresh.filter(order => cityId(order));
  }
  if (!resume.length && !fresh.length) return { ok: true, id: batchId ?? null, shipped: [], errors };

  // Claim before booking. The unique orderId on batch items means a second
  // request for the same order cannot claim it, so it never reaches the courier.
  const createdBatch = !batchId;
  if (!batchId) batchId = (await prisma.shipmentBatch.create({ data: { tenantId, userId, provider }, select: { id: true } })).id;
  if (takenOver.length) await prisma.shipmentBatchItem.deleteMany({ where: { id: { in: takenOver }, order: { trackingNumber: null } } });
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
    const results = await transExpress.createBulkShipmentsWithCityIds(fresh.map(order => ({
      orderId: order.id,
      orderNo: orderNo(order, orderNoPrefix),
      customerName: order.customerName,
      customerAddress: order.customerAddress,
      cityId: cityId(order)!,
      customerPhone: order.customerPhone,
      customerSecondPhone: order.customerSecondPhone || undefined,
      orderTotal: order.codAmount ?? order.total,
      weight: overrides[order.id]?.weight ?? input.weight,
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
  // The courier answered for these and booked nothing, so the claim can go.
  const unbooked = fresh.filter(order => !waybills.has(order.id)).map(order => order.id);
  if (unbooked.length) await prisma.shipmentBatchItem.deleteMany({ where: { batchId, orderId: { in: unbooked } } });

  const toRecord = [...resume.map(order => [order, order.trackingNumber!] as const), ...fresh.filter(order => waybills.has(order.id)).map(order => [order, waybills.get(order.id)!] as const)];
  const shipped: Array<{ orderId: string; number: number; trackingNumber: string }> = [];
  for (const [order, waybill] of toRecord) {
    try {
      await transitionOrder({ orderId: order.id, tenantId, userId, to: OrderStatus.SHIPPED, source: 'shipment batch', shipping: { provider, trackingNumber: waybill } });
      shipped.push({ orderId: order.id, number: order.number, trackingNumber: waybill });
    } catch (error) {
      // The waybill and claim stay, so shipping it again records it without a second booking.
      fail(order, `Booked as ${waybill} but not recorded: ${error instanceof Error ? error.message : 'unknown error'} Ship it again to finish; it will not be booked twice.`);
    }
  }

  if (createdBatch && !toRecord.length) {
    await prisma.shipmentBatch.delete({ where: { id: batchId } });
    return { ok: true, id: null, shipped, errors };
  }
  return { ok: true, id: batchId, shipped, errors };
}
