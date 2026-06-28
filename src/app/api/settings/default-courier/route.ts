import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ShippingProvider } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

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
