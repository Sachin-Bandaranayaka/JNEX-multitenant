import { NextResponse } from 'next/server';
import { requireTenantAdmin } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { getWalletSummary } from '@/lib/billing/credits';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireTenantAdmin();
  if (!guard.ok) return guard.response;
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: guard.tenantId }, select: { billingMode: true } });
    if (tenant.billingMode !== 'PREPAID') return NextResponse.json({ billingMode: tenant.billingMode }, { headers });
    const wallet = await getWalletSummary(guard.tenantId);
    return NextResponse.json({ billingMode: wallet.billingMode, available: wallet.available, held: wallet.held, spendable: wallet.spendable }, { headers });
  } catch {
    return NextResponse.json({ error: 'Unable to load billing summary' }, { status: 503, headers });
  }
}
