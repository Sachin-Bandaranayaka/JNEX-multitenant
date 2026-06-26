import { ShippingProviderFactory } from '@/lib/shipping/factory';
import { prisma, getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { ShippingProvider } from '@prisma/client';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface RouteParams {
  trackingNumber: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const resolvedParams = await params;

    // Tenant-scoped client: a tracking number is only resolvable to an order
    // within the caller's own tenant.
    const scopedPrisma = getScopedPrismaClient(session.user.tenantId);

    // Find the order with this tracking number
    const order = await scopedPrisma.order.findFirst({
      where: { trackingNumber: resolvedParams.trackingNumber },
      include: {
        trackingUpdates: {
          orderBy: {
            timestamp: 'desc'
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Get the provider name from the order's shippingProvider field
    if (!order.shippingProvider) {
      return NextResponse.json(
        { error: 'Shipping provider not found' },
        { status: 404 }
      );
    }

    // Convert enum value (e.g. FARDA_EXPRESS) to the factory key (farda_express).
    // The factory registers providers with underscores, so we must NOT replace
    // underscores with spaces here.
    const providerName = order.shippingProvider.toLowerCase();

    // Get the shipping provider
    const tenantId = session.user.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        fardaExpressClientId: true,
        fardaExpressApiKey: true,
        transExpressApiKey: true,
        royalExpressApiKey: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const shippingProviderFactory = new ShippingProviderFactory({
      fardaExpressClientId: tenant.fardaExpressClientId || undefined,
      fardaExpressApiKey: tenant.fardaExpressApiKey || undefined,
      transExpressApiKey: tenant.transExpressApiKey || undefined,
      royalExpressApiKey: tenant.royalExpressApiKey || undefined,
    });

    const provider = shippingProviderFactory.getProvider(providerName);

    // Track the shipment
    const status = await provider.trackShipment(resolvedParams.trackingNumber);

    // Update order status if needed
    if (status === 'DELIVERED' && order.status !== 'DELIVERED') {
      await scopedPrisma.order.update({
        where: { id: order.id },
        data: { status: 'DELIVERED' },
      });
    }

    return NextResponse.json({ status });
  } catch (error) {
    console.error('Tracking error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to track shipment'
    }, { status: 500 });
  }
}
