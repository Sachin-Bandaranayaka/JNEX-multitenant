import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { createStockRequest, StockRequestError } from '@/lib/stock-change-requests';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const guard = await requirePermission('VIEW_PRODUCTS');
  if (!guard.ok) return guard.response;
  const query = new URL(request.url).searchParams;
  const status = query.get('status'); const kind = query.get('kind'); const productId = query.get('productId');
  const requests = await prisma.stockChangeRequest.findMany({ where: {
    tenantId: guard.tenantId,
    ...(status && ['PENDING','APPROVED','REJECTED'].includes(status) ? { status } : {}),
    ...(kind && ['ADJUSTMENT','WASTE'].includes(kind) ? { kind } : {}),
    ...(productId ? { productId } : {}),
  }, include: { product: { select: { id: true, code: true, name: true } }, requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } }, stockAdjustment: true }, orderBy: { createdAt: 'desc' }, take: 500 });
  return NextResponse.json(requests, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request) {
  const guard = await requirePermission('EDIT_PRODUCTS');
  if (!guard.ok) return guard.response;
  try { return NextResponse.json(await createStockRequest(guard.tenantId, guard.session.user.id, await request.json()), { status: 201 }); }
  catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues.map(issue => issue.message).join(' ') }, { status: 400 });
    if (error instanceof StockRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Unable to submit stock request.' }, { status: 500 });
  }
}
