// src/app/api/store/purchases/[purchaseId]/route.ts

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET - Get single purchase
export async function GET(
  request: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { purchaseId } = await params;
    const isSuperAdmin = session.user.role === 'SUPER_ADMIN';

    const purchase = await prisma.storePurchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, businessName: true } },
        items: {
          include: { storeProduct: true },
        },
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    // Only allow access to own purchases or super admin
    if (!isSuperAdmin && purchase.userId !== session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('Error fetching purchase:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase' }, { status: 500 });
  }
}
