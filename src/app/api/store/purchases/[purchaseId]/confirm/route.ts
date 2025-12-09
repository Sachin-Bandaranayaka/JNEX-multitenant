// src/app/api/store/purchases/[purchaseId]/confirm/route.ts

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const confirmSchema = z.object({
  action: z.enum(['confirm', 'reject']),
  rejectionReason: z.string().optional(),
});

// POST - Confirm or reject purchase (Super Admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ purchaseId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { purchaseId } = await params;
    const data = await request.json();
    const { action, rejectionReason } = confirmSchema.parse(data);

    // Get purchase with items
    const purchase = await prisma.storePurchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: { include: { storeProduct: true } },
        tenant: true,
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    if (purchase.status !== 'PENDING') {
      return NextResponse.json({ error: 'Purchase already processed' }, { status: 400 });
    }

    if (action === 'reject') {
      // Reject purchase
      const updatedPurchase = await prisma.storePurchase.update({
        where: { id: purchaseId },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Payment not verified',
        },
      });

      return NextResponse.json(updatedPurchase);
    }

    // Confirm purchase - validate stock and add to tenant's products
    await prisma.$transaction(async (tx) => {
      // Validate stock availability
      for (const item of purchase.items) {
        if (item.storeProduct.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.storeProduct.name}`);
        }
      }

      // Update purchase status
      await tx.storePurchase.update({
        where: { id: purchaseId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          confirmedBy: session.user.id,
        },
      });

      // Deduct stock from store products
      for (const item of purchase.items) {
        await tx.storeProduct.update({
          where: { id: item.storeProductId },
          data: {
            stock: { decrement: item.quantity },
          },
        });
      }

      // Add stock to tenant's products (create if doesn't exist)
      for (const item of purchase.items) {
        const storeProduct = item.storeProduct;
        
        // Check if tenant already has this product (by matching name or creating new)
        const existingProduct = await tx.product.findFirst({
          where: {
            tenantId: purchase.tenantId,
            name: storeProduct.name,
          },
        });

        if (existingProduct) {
          // Update existing product stock
          const previousStock = existingProduct.stock;
          const newStock = previousStock + item.quantity;

          await tx.product.update({
            where: { id: existingProduct.id },
            data: { stock: newStock },
          });

          // Create stock adjustment record
          await tx.stockAdjustment.create({
            data: {
              productId: existingProduct.id,
              quantity: item.quantity,
              reason: `Store purchase #${purchaseId.slice(-8)}`,
              previousStock,
              newStock,
              userId: purchase.userId,
              tenantId: purchase.tenantId,
            },
          });
        } else {
          // Create new product for tenant
          const productCode = `SP-${storeProduct.sku}`;
          
          // Check if code exists, if so append timestamp
          const existingCode = await tx.product.findFirst({
            where: { code: productCode, tenantId: purchase.tenantId },
          });

          const finalCode = existingCode 
            ? `${productCode}-${Date.now()}` 
            : productCode;

          const newProduct = await tx.product.create({
            data: {
              code: finalCode,
              name: storeProduct.name,
              description: storeProduct.description,
              price: item.priceAtPurchase,
              stock: item.quantity,
              tenantId: purchase.tenantId,
            },
          });

          // Create stock adjustment record
          await tx.stockAdjustment.create({
            data: {
              productId: newProduct.id,
              quantity: item.quantity,
              reason: `Store purchase #${purchaseId.slice(-8)} - Initial stock`,
              previousStock: 0,
              newStock: item.quantity,
              userId: purchase.userId,
              tenantId: purchase.tenantId,
            },
          });
        }
      }
    });

    const updatedPurchase = await prisma.storePurchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: { include: { storeProduct: true } },
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, businessName: true } },
      },
    });

    return NextResponse.json(updatedPurchase);
  } catch (error) {
    console.error('Error confirming purchase:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to confirm purchase' }, { status: 500 });
  }
}
