import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyPermission, requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { shipBatch } from '@/lib/shipping/ship-batch';

export const dynamic = 'force-dynamic';

const schema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(100),
  provider: z.enum(['TRANS_EXPRESS', 'FARDA_EXPRESS', 'SL_POST']),
  trackingNumbers: z.record(z.string().trim().min(1)).optional(),
  batchId: z.string().min(1).optional(),
  confirmedUnbooked: z.array(z.string().min(1)).optional(),
});

export async function GET() {
  const guard = await requirePermission('VIEW_SHIPPING');
  if (!guard.ok) return guard.response;
  const batches = await prisma.shipmentBatch.findMany({
    where: { tenantId: guard.tenantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true } }, items: { include: { order: { select: { number: true, trackingNumber: true, status: true } } }, orderBy: { position: 'asc' } } },
  });
  return NextResponse.json(batches);
}

export async function POST(request: Request) {
  const guard = await requireAnyPermission(['UPDATE_SHIPPING_STATUS', 'EDIT_ORDERS']);
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Select orders and an active courier.' }, { status: 400 });
  const result = await shipBatch({ ...parsed.data, tenantId: guard.tenantId, userId: guard.session.user.id });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const { id, shipped, errors } = result;
  if (!shipped.length) return NextResponse.json({ id, error: 'No orders were shipped.', shippedCount: 0, errors }, { status: 422 });
  return NextResponse.json({ id, shippedCount: shipped.length, errors }, { status: 201 });
}
