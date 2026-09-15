import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requirePermission('VIEW_ORDERS');
  if (!guard.ok) return guard.response;
  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: guard.tenantId },
    select: {
      number: true, status: true, createdAt: true, shippedAt: true, deliveredAt: true,
      trackingUpdates: {
        orderBy: { timestamp: 'asc' },
        select: { id: true, status: true, timestamp: true, description: true, location: true },
      },
      statusHistory: {
        orderBy: { timestamp: 'asc' },
        select: { id: true, status: true, timestamp: true, description: true, location: true },
      },
    },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json(order, { headers: { 'Cache-Control': 'private, no-store' } });
}
