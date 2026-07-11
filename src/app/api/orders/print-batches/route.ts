import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({ orderIds: z.array(z.string().min(1)).min(1).max(500) });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order selection' }, { status: 400 });
  const orderIds = [...new Set(parsed.data.orderIds)];
  const count = await prisma.order.count({ where: { id: { in: orderIds }, tenantId: session.user.tenantId } });
  if (count !== orderIds.length) return NextResponse.json({ error: 'One or more orders were not found' }, { status: 404 });
  const batch = await prisma.invoicePrintBatch.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      items: { create: orderIds.map((orderId, position) => ({ orderId, position })) },
    },
  });
  return NextResponse.json({ id: batch.id });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const batch = await prisma.invoicePrintBatch.findFirst({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { position: 'asc' }, select: { orderId: true } } },
  });
  return NextResponse.json(batch ? { id: batch.id, confirmedAt: batch.confirmedAt, orderIds: batch.items.map(i => i.orderId) } : null);
}
