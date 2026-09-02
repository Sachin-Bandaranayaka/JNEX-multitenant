import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ShippingProvider } from '@prisma/client';
import { requirePermission, requireAnyPermission } from '@/lib/authz';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // The tenant-wide default courier is a business setting, even though the
    // control lives in the dashboard header.
    const guard = await requirePermission('MANAGE_SETTINGS');
    if (!guard.ok) return guard.response;
    const session = guard.session;

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { defaultShippingProvider } = body;

    if (!defaultShippingProvider || !Object.values(ShippingProvider).includes(defaultShippingProvider)) {
      return NextResponse.json({ error: 'Invalid shipping provider' }, { status: 400 });
    }

    await prisma.tenant.update({
      where: { id: session.user.tenantId },
      data: { defaultShippingProvider },
    });

    return NextResponse.json({ success: true, defaultShippingProvider });
  } catch (error) {
    console.error('Error updating default shipping provider:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
