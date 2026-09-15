import { NextResponse } from 'next/server';
import { requireTenantAdmin } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function POST() {
  const guard = await requireTenantAdmin();
  if (!guard.ok) return guard.response;
  return NextResponse.json(
    { error: 'Royal Express is retired. Historical shipments remain available.' },
    { status: 410 },
  );
}
