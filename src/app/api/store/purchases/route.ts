// src/app/api/store/purchases/route.ts

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const checkoutSchema = z.object({
  bankReceiptNumber: z.string().min(1, 'Bank receipt number is required'),
  whatsappNumber: z.string().min(1, 'WhatsApp number is required'),
  transferTime: z.string().transform((val) => new Date(val)),
});

// GET - Get user's purchases (or all purchases for super admin)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const isSuperAdmin = session.user.role === 'SUPER_ADMIN';

    const purchases = await prisma.storePurchase.findMany({
      where: {
        ...(isSuperAdmin ? {} : { userId: session.user.id }),
        ...(status ? { status: status as 'PENDING' | 'CONFIRMED' | 'REJECTED' } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, businessName: true } },
        items: {
          include: {
            storeProduct: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
  }
}

// POST - Create purchase (checkout)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const data = await request.json();
    const validatedData = checkoutSchema.parse(data);

    // Get user's cart
    const cart = await prisma.cart.findUnique({
      where: { userId: session.user.id },
      include: {
        items: {
          include: { storeProduct: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Validate stock for all items
    for (const item of cart.items) {
      if (item.storeProduct.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${item.storeProduct.name}` },
          { status: 400 }
        );
      }
    }

    // Calculate total
    const totalAmount = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.storeProduct.price,
      0
    );

    // Create purchase in transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // Create purchase
      const newPurchase = await tx.storePurchase.create({
        data: {
          userId: session.user.id,
          tenantId: session.user.tenantId,
          bankReceiptNumber: validatedData.bankReceiptNumber,
          whatsappNumber: validatedData.whatsappNumber,
          transferTime: validatedData.transferTime,
          totalAmount,
          items: {
            create: cart.items.map((item) => ({
              storeProductId: item.storeProductId,
              quantity: item.quantity,
              priceAtPurchase: item.storeProduct.price,
            })),
          },
        },
        include: {
          items: { include: { storeProduct: true } },
        },
      });

      // Clear cart
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return newPurchase;
    });

    return NextResponse.json(purchase);
  } catch (error) {
    console.error('Error creating purchase:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create purchase' }, { status: 500 });
  }
}
