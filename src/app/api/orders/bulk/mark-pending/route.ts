// src/app/api/orders/bulk/mark-pending/route.ts

import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, requireAnyPermission } from '@/lib/authz';

const MarkPendingSchema = z.object({
  orderIds: z.array(z.string()),
});

export async function POST(request: Request) {
  try {
    const guard = await requirePermission('EDIT_ORDERS');
    if (!guard.ok) return guard.response;
    const session = guard.session;

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);
    const json = await request.json();
    const { orderIds } = MarkPendingSchema.parse(json);

    if (orderIds.length === 0) {
      return NextResponse.json({ message: 'No orders to update.' });
    }

    // Use updateMany to set invoicePrinted to false for the selected orders
    const result = await prisma.order.updateMany({
      where: {
        id: {
          in: orderIds,
        },
      },
      data: {
        invoicePrinted: false, // Set the status to false
      },
    });

    return NextResponse.json({
      message: `Successfully updated ${result.count} orders.`,
      count: result.count,
    });
  } catch (error) {
    console.error('Error marking orders as pending:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update orders' }, { status: 500 });
  }
}
