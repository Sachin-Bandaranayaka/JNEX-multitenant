import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, AuthorizationError } from '@/lib/superadmin-auth';
import { reviewStockRequest, StockRequestError } from '@/lib/stock-change-requests';
export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const { actor } = await requireSuperAdmin();
    const { decision, note } = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().trim().min(3).max(500) }).parse(await request.json());
    return NextResponse.json(await reviewStockRequest((await params).requestId, actor.id, decision, note));
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof StockRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Choose a decision and provide a review note.' }, { status: 400 });
    return NextResponse.json({ error: 'Unable to review stock request.' }, { status: 500 });
  }
}
