import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { getScopedPrismaClient, prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { OrderStatus } from '@prisma/client';
import { transitionOrder } from '@/lib/order-workflow';
import { planBulkShipment } from '@/lib/billing/credits';
import { requireAnyPermission } from '@/lib/authz';

export const dynamic = 'force-dynamic';

interface BulkOrderInput {
  orderId: string;
  weight?: number;
}

export async function POST(request: Request) {
  try {
    const guard = await requireAnyPermission(['UPDATE_SHIPPING_STATUS', 'EDIT_ORDERS']);
    if (!guard.ok) return guard.response;
    const session = guard.session;

    const tenantId = session.user.tenantId;
    const body = await request.json();
    const { orderIds, orders, weight }: { 
      orderIds?: string[]; 
      orders?: Array<{ orderId: string; cityId: number; weight?: number }>; 
      weight?: number 
    } = body;

    const idsToFetch = orders ? orders.map(o => o.orderId) : orderIds;

    if (!Array.isArray(idsToFetch) || idsToFetch.length === 0) {
      return NextResponse.json({ error: 'orderIds or orders array must be provided' }, { status: 400 });
    }

    // Get tenant API key
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { transExpressApiKey: true, transExpressOrderPrefix: true },
    });

    if (!tenant?.transExpressApiKey) {
      return NextResponse.json(
        { error: 'Trans Express API key not configured for this tenant' },
        { status: 400 }
      );
    }

    // Fetch all requested orders (scoped to tenant)
    const scopedPrisma = getScopedPrismaClient(tenantId);
    const ordersFromDb = await scopedPrisma.order.findMany({
      where: { id: { in: idsToFetch }, status: 'CONFIRMED' },
      select: {
        id: true,
        number: true,
        customerName: true,
        customerAddress: true,
        customerCity: true,
        shippingLocationProvider: true,
        shippingDistrictId: true,
        shippingDistrictName: true,
        shippingCityId: true,
        shippingCityName: true,
        customerPhone: true,
        customerSecondPhone: true,
        total: true,
        lead: { select: { csvData: true } },
      },
    });

    if (ordersFromDb.length === 0) {
      return NextResponse.json({ error: 'No eligible CONFIRMED orders found' }, { status: 400 });
    }

    const provider = new TransExpressProvider(tenant.transExpressApiKey);
    const prefix = tenant.transExpressOrderPrefix || undefined;

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const datePart = `${dd}${mm}${yy}`;

    // Budgeted across the whole batch: ten orders that each pass on their own
    // can still overdraw the wallet together. Orders that do not fit are
    // reported alongside the ones that shipped rather than failing the batch.
    const plan = await planBulkShipment(
      tenantId,
      ordersFromDb.map((o) => ({ orderId: o.id, orderTotal: o.total })),
    );
    const fundable = new Set(plan.allowed);

    const locationErrors: Array<{
      orderId: string;
      orderNo: string;
      trackingNumber?: string;
      error: string;
    }> = plan.blocked.map((blocked) => ({
      orderId: blocked.orderId,
      orderNo: String(ordersFromDb.find((o) => o.id === blocked.orderId)?.number ?? blocked.orderId),
      error: `Not enough credit — this order needs ${blocked.required} credit(s). Top up and try again.`,
    }));

    const shipmentInputs = ordersFromDb.filter((o) => fundable.has(o.id)).flatMap((o) => {
        // Keep accepting explicit city IDs for backwards compatibility, but the
        // normal queue flow now uses the location saved during confirmation.
        const manualOrder = orders?.find((item) => item.orderId === o.id);
        const cityId = manualOrder?.cityId || (
          o.shippingLocationProvider === 'TRANS_EXPRESS' ? o.shippingCityId : null
        );
        const orderNo = `${prefix || 'ORD'}-${o.number}-${datePart}`;

        if (!cityId) {
          locationErrors.push({
            orderId: o.id,
            orderNo,
            error: 'This older order has no saved Trans Express location. Ship it individually and select the city once.',
          });
          return [];
        }

        return [{
          orderId: o.id,
          orderNo,
          customerName: o.customerName,
          customerAddress: o.customerAddress,
          cityId,
          customerPhone: o.customerPhone,
          customerSecondPhone: o.customerSecondPhone || undefined,
          orderTotal: o.total,
          weight: manualOrder?.weight ?? weight ?? 1,
        }];
    });

    const shipmentResults = shipmentInputs.length > 0
      ? await provider.createBulkShipmentsWithCityIds(shipmentInputs)
      : [];
    const results = [...shipmentResults, ...locationErrors];

    // Persist successful shipments through the state machine rather than
    // writing `status` directly. Going straight to the column skipped status
    // history, the transition rules, and — now — the credit hold, so a bulk
    // shipment could leave with no reservation against it at all.
    await Promise.allSettled(
      results
        .filter((r) => r.trackingNumber)
        .map((r) =>
          transitionOrder({
            orderId: r.orderId,
            tenantId,
            userId: session.user.id,
            to: OrderStatus.SHIPPED,
            source: 'Trans Express bulk shipment',
            shipping: { provider: 'TRANS_EXPRESS', trackingNumber: r.trackingNumber as string },
          }),
        ),
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Trans Express bulk create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create bulk shipments' },
      { status: 500 }
    );
  }
}
