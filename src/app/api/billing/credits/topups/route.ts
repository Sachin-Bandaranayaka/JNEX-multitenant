// src/app/api/billing/credits/topups/route.ts
//
// Tenants buy shipping credit here. Submitting only records a claim — the
// wallet is funded by a super admin confirming the transfer, never by the
// tenant saying they sent it.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { listTopUps, quoteTopUp, submitTopUp } from '@/lib/billing/topups';
import { getWalletSummary } from '@/lib/billing/credits';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  credits: z.number().positive('Enter how many credits you want to buy'),
  bankReceiptNumber: z.string().min(1, 'Bank receipt number is required'),
  whatsappNumber: z.string().min(1, 'WhatsApp number is required'),
  transferTime: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid transfer time'),
});

/** The wallet, recent purchases, and what a given quantity would cost. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  const requested = Number(new URL(request.url).searchParams.get('credits'));

  const [wallet, topUps, quote] = await Promise.all([
    getWalletSummary(tenantId),
    listTopUps(tenantId),
    Number.isFinite(requested) && requested > 0
      ? quoteTopUp({ tenantId, credits: requested })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({ wallet, topUps, quote });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const parsed = submitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map((issue) => issue.message).join(' ') },
      { status: 400 },
    );
  }

  try {
    const topUp = await submitTopUp({
      tenantId: session.user.tenantId,
      submittedByUserId: session.user.id,
      credits: parsed.data.credits,
      bankReceiptNumber: parsed.data.bankReceiptNumber.trim(),
      whatsappNumber: parsed.data.whatsappNumber.trim(),
      transferTime: new Date(parsed.data.transferTime),
    });
    return NextResponse.json(topUp);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit top-up' },
      { status: 400 },
    );
  }
}
