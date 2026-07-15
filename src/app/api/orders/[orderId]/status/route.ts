// src/app/api/orders/[orderId]/status/route.ts

import { updateOrderStatus } from '@/lib/orders';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const UpdateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED']),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    
    const resolvedParams = await params;const session = await getServerSession(authOptions);

    // 1. Check for session and tenantId
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const json = await request.json();
    const { status } = UpdateOrderStatusSchema.parse(json);

    const permissions = session.user.permissions || [];
    const isAdmin = session.user.role === 'ADMIN';
    const hasPermission = status === 'CANCELLED'
      ? isAdmin || permissions.includes('DELETE_ORDERS')
      : isAdmin || permissions.includes('EDIT_ORDERS') || permissions.includes('UPDATE_SHIPPING_STATUS');
    if (!hasPermission) {
      return NextResponse.json({ error: 'You do not have permission to update this order.' }, { status: 403 });
    }

    // 2. Pass the tenantId and userId to the update function
    const order = await updateOrderStatus(resolvedParams.orderId, status, session.user.tenantId, session.user.id);

    return NextResponse.json(order);
  } catch (error) {
    console.error('Order status update error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update order status'
    }, { status: 400 });
  }
}
