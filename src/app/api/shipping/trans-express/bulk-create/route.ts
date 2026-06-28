import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { getScopedPrismaClient, prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface BulkOrderInput {
  orderId: string;
  weight?: number;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

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

    let results;

    if (orders) {
      // Manual City ID flow
      const shipmentInputs = ordersFromDb.map((o) => {
        const manualOrder = orders.find(mo => mo.orderId === o.id);
        const cityId = manualOrder?.cityId || 864; // Default to Colombo 1 if missing
        const orderNo = `${prefix || 'ORD'}-${o.number}-${datePart}`;
        const w = manualOrder?.weight ?? weight ?? 1;

        return {
          orderId: o.id,
          orderNo,
          customerName: o.customerName,
          customerAddress: o.customerAddress,
          cityId,
          customerPhone: o.customerPhone,
          customerSecondPhone: o.customerSecondPhone || undefined,
          orderTotal: o.total,
          weight: w,
        };
      });

      results = await provider.createBulkShipmentsWithCityIds(shipmentInputs);
    } else {
      // Auto City Name flow
      const shipmentInputs = ordersFromDb.map((o) => {
        // Use customerCity if available, otherwise fall back to the lead's CSV city data
        const leadCsvData = o.lead?.csvData as any;
        let city = o.customerCity || leadCsvData?.city || leadCsvData?.customerCity || '';

        // If city is still empty, try to extract it from the address (last comma-separated part)
        if (!city && o.customerAddress) {
          const parts = o.customerAddress.split(/[,\s]+/).map((p: string) => p.trim()).filter(Boolean);
          if (parts.length > 1) {
            city = parts[parts.length - 1]; // Use the last part as a city guess
          } else if (parts.length === 1) {
            city = parts[0];
          }
        }

        // Generate order_no: PREFIX-NUMBER-DDMMYY
        const orderNo = `${prefix || 'ORD'}-${o.number}-${datePart}`;

        return {
          orderId: o.id,
          orderNo,
          customerName: o.customerName,
          customerAddress: o.customerAddress,
          customerCity: city,
          customerPhone: o.customerPhone,
          customerSecondPhone: o.customerSecondPhone || undefined,
          orderTotal: o.total,
          weight: weight ?? 1,
        };
      });

      // Use the "without-city" endpoint which accepts city as a string name
      // and lets Trans Express auto-resolve it (more forgiving than exact city ID matching)
      results = await provider.createBulkShipmentsByCityName(shipmentInputs);
    }

    // Persist successful shipments to the DB
    const updatePromises = results
      .filter((r) => r.trackingNumber)
      .map((r) =>
        scopedPrisma.order.update({
          where: { id: r.orderId },
          data: {
            status: 'SHIPPED',
            shippingProvider: 'TRANS_EXPRESS',
            trackingNumber: r.trackingNumber,
            shippedAt: new Date(),
          },
        })
      );

    await Promise.allSettled(updatePromises);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Trans Express bulk create error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create bulk shipments' },
      { status: 500 }
    );
  }
}
