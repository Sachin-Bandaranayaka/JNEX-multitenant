import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';
import { transitionOrder } from '@/lib/order-workflow';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Tenant-scoped client: refund/return processing and the resulting stock
    // increment can only ever touch the caller's own tenant data.
    const prisma = getScopedPrismaClient(session.user.tenantId);

    const body = await request.json();
    const { reason, description, refundMethod, returnShipping } = body;

    // Validate required fields
    if (!reason || !description || !refundMethod || !returnShipping) {
      return NextResponse.json(
        { error: 'Missing required return information' },
        { status: 400 }
      );
    }

    // Get the order and verify it exists (scoped to the caller's tenant)
    const order = await prisma.order.findFirst({
      where: { id: resolvedParams.orderId },
      include: {
        product: true
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order is already returned
    if (order.status === OrderStatus.RETURNED) {
      return NextResponse.json(
        { error: 'Order is already returned' },
        { status: 400 }
      );
    }

    // Check if order can be returned (only DELIVERED or SHIPPED orders)
    if (!['DELIVERED', 'SHIPPED'].includes(order.status)) {
      return NextResponse.json(
        { error: 'Order cannot be returned. Only delivered or shipped orders are eligible for return.' },
        { status: 400 }
      );
    }

    const result = await transitionOrder({
      orderId: order.id,
      tenantId: session.user.tenantId,
      userId: session.user.id,
      to: OrderStatus.RETURNED,
      source: 'return form',
      description: `Return: ${reason} — ${description} (${refundMethod}, ${returnShipping})`,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing return:', error);
    return NextResponse.json(
      { error: 'Failed to process return' },
      { status: 500 }
    );
  }
}
