import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { OrderStatus } from '@prisma/client';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { transitionOrder } from '@/lib/order-workflow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  updates: z.array(z.object({
    orderId: z.string().min(1),
    newStatus: z.literal('DELIVERED'),
    statusChangeDate: z.string().nullable().optional(),
    sourceWaybill: z.string().optional(),
  })).min(1).max(5000),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.errors }, { status: 400 });

  const results = [];
  for (const update of parsed.data.updates) {
    try {
      const occurredAt = update.statusChangeDate && !Number.isNaN(Date.parse(update.statusChangeDate))
        ? new Date(update.statusChangeDate) : new Date();
      const order = await transitionOrder({
        orderId: update.orderId,
        tenantId: session.user.tenantId,
        userId: session.user.id,
        to: update.newStatus as OrderStatus,
        occurredAt,
        source: 'courier file',
        description: `Courier bulk update${update.sourceWaybill ? ` — waybill ${update.sourceWaybill}` : ''}`,
      });
      results.push({ orderId: update.orderId, success: true, newStatus: order.status });
    } catch (error) {
      results.push({ orderId: update.orderId, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
  const successCount = results.filter(r => r.success).length;
  return NextResponse.json({
    success: successCount === results.length,
    processed: results.length,
    successCount,
    failureCount: results.length - successCount,
    summary: {
      delivered: results.filter(r => r.success && r.newStatus === 'DELIVERED').length,
    },
    results,
  });
}
