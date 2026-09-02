import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, requireAnyPermission } from '@/lib/authz';

export async function POST(_: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const guard = await requireAnyPermission(['CREATE_ORDERS', 'EDIT_ORDERS']);
  if (!guard.ok) return guard.response;
  const session = guard.session;
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
