import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { batchId } = await params;
  const batch = await prisma.invoicePrintBatch.findFirst({
    where: { id: batchId, tenantId: session.user.tenantId },
    include: { items: { select: { orderId: true } } },
  });
  if (!batch) return NextResponse.json({ error: 'Print batch not found' }, { status: 404 });
  await prisma.$transaction([
    prisma.invoicePrintBatch.update({ where: { id: batch.id }, data: { confirmedAt: batch.confirmedAt ?? new Date() } }),
    prisma.order.updateMany({
      where: { tenantId: session.user.tenantId, id: { in: batch.items.map(i => i.orderId) } },
      data: { invoicePrinted: true },
    }),
  ]);
  return NextResponse.json({ success: true, count: batch.items.length });
}
