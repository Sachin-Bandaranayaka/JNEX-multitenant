import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/authz';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const guard = await requireAnyPermission(['UPDATE_SHIPPING_STATUS', 'EDIT_ORDERS']);
    if (!guard.ok) return guard.response;
    const session = guard.session;

    const body = await request.json();
    const {
      orderId,
      customerName,
      customerAddress,
      customerPhone,
      customerSecondPhone,
      cityName,
      weight,
      service,
      orderTotal,
      orderPrefix,
      orderNumber,
    } = body;

    // Validate required fields
    if (!orderId || !customerName || !customerAddress || !customerPhone || !cityName) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, customerName, customerAddress, customerPhone, cityName' },
        { status: 400 }
      );
    }

    const tenantId = session.user.tenantId;

    // Get the tenant's Trans Express API key
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        transExpressApiKey: true,
      },
    });

    if (!tenant?.transExpressApiKey) {
      return NextResponse.json(
        { error: 'Trans Express API key not configured for this tenant' },
        { status: 400 }
      );
    }

    // Create the provider and make the shipment server-side
    const transExpress = new TransExpressProvider(tenant.transExpressApiKey);

    const result = await transExpress.createShipmentByCityName(
      {
        name: customerName,
        street: customerAddress,
        city: cityName,
        state: '',
        postalCode: '',
        country: 'LK',
        phone: customerPhone,
        alternatePhone: customerSecondPhone || '',
      },
      {
        weight: parseFloat(weight) || 1,
        length: 10,
        width: 10,
        height: 10,
      },
      service || 'Standard',
      cityName,
      orderTotal || 0,
      tenantId,
      orderId,
      orderPrefix,
      orderNumber
    );

    return NextResponse.json({
      trackingNumber: result.trackingNumber,
      labelUrl: result.labelUrl,
      provider: result.provider,
    });
  } catch (error) {
    console.error('Trans Express create shipment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Trans Express shipment' },
      { status: 500 }
    );
  }
}
