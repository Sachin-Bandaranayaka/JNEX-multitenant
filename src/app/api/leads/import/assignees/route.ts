import { NextResponse } from 'next/server';
import { requireTenantAdmin } from '@/lib/authz';
import { getScopedPrismaClient } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireTenantAdmin();
  if (!guard.ok) return guard.response;
  try {
    const staff = await getScopedPrismaClient(guard.tenantId).user.findMany({
      where: { tenantId: guard.tenantId, isActive: true, role: { not: 'SUPER_ADMIN' } },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return NextResponse.json({ staff }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load staff.' }, { status: 503 });
  }
}
