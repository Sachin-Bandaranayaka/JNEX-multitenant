// src/app/api/orders/[orderId]/shipping/route.ts

import { getScopedPrismaClient } from '@/lib/prisma'; // <-- Import our scoped client
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requirePermission, requireAnyPermission } from '@/lib/authz';

export const dynamic = 'force-dynamic';

// We no longer need a local prisma client instance
// const prisma = new PrismaClient(); // <-- REMOVED

// SECURED POST HANDLER
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    
    const resolvedParams = await params;
    const guard = await requireAnyPermission(['UPDATE_SHIPPING_STATUS', 'EDIT_ORDERS']);
    if (!guard.ok) return guard.response;
    const session = guard.session;

    // 1. Check for session and tenantId
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Use the scoped client
    const prisma = getScopedPrismaClient(session.user.tenantId);

    const data = await request.json();
    const { shippingProvider, trackingNumber } = data;

    if (!shippingProvider || !trackingNumber) {
      return NextResponse.json({ error: 'Shipping provider and tracking number are required' }, { status: 400 });
    }

    // 3. This update is now SECURE. It will only update the order if the ID matches
    // AND the order belongs to the current tenant.
    const updatedOrder = await prisma.order.update({
      where: { id: resolvedParams.orderId },
      data: {
        status: 'SHIPPED',
        shippingProvider,
        trackingNumber,
        shippedAt: new Date(),
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    // Prisma's update will throw an error if the record is not found,
    // which protects against updating orders from other tenants.
    console.error('Error updating shipping information:', error);
    return NextResponse.json({ error: 'Failed to update shipping information. Order not found or permission denied.' }, { status: 500 });
  }
}

// SECURED GET HANDLER
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    
    const resolvedParams = await params;const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    // Use the scoped client
    const prisma = getScopedPrismaClient(session.user.tenantId);

    // This find is now SECURE. It will only return the order if it belongs to the tenant.
    const order = await prisma.order.findUnique({
      where: { id: resolvedParams.orderId },
      select: {
        shippingProvider: true,
        trackingNumber: true,
        shippedAt: true,
        deliveredAt: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching shipping information:', error);
    return NextResponse.json({ error: 'Failed to fetch shipping information' }, { status: 500 });
  }
}