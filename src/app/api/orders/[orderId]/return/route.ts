import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderStatus } from '@prisma/client';

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

    // Update order status and adjust product stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order status to RETURNED
      const updatedOrder = await tx.order.update({
        where: { id: resolvedParams.orderId },
        data: { status: OrderStatus.RETURNED },
        include: {
          product: true
        }
      });

      // Add the returned quantity back to product stock
      await tx.product.update({
        where: { id: order.product.id },
        data: {
          stock: {
            increment: order.quantity
          }
        }
      });

      // Create a stock adjustment record
      await tx.stockAdjustment.create({
        data: {
          quantity: order.quantity,
          reason: `Return from order ${order.id}`,
          previousStock: order.product.stock,
          newStock: order.product.stock + order.quantity,
          tenant: {
            connect: {
              id: session.user.tenantId,
            },
          },
          product: {
            connect: {
              id: order.product.id,
            },
          },
          adjustedBy: {
            connect: {
              id: session.user.id,
            },
          },
        }
      });

      return updatedOrder;
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