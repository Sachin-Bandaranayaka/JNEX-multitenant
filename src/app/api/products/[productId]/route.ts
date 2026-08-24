// src/app/api/products/[productId]/route.ts

import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { transformProduct } from '@/lib/products';

export const dynamic = 'force-dynamic';

const productUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be >= 0').max(1000000, 'Price must be < 1,000,000'),
  stock: z.number().min(0, 'Stock must be >= 0').max(100000, 'Stock must be < 100,000'),
  lowStockAlert: z.number().min(0, 'Low stock alert must be >= 0').max(100000, 'Low stock alert must be < 100,000'),
});

// GET handler is already secure, but we'll add an explicit permission check for consistency.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    
    const resolvedParams = await params;const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    // Permission Check
    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('VIEW_PRODUCTS')) {
        return new NextResponse('Forbidden', { status: 403 });
    }
    
    const prisma = getScopedPrismaClient(session.user.tenantId);
    const product = await prisma.product.findUnique({
      where: { id: resolvedParams.productId },
      include: {
        _count: { select: { orders: true, leads: true } },
        stockAdjustments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const formattedProduct = transformProduct(product);
    return NextResponse.json(formattedProduct);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

// SECURED PUT HANDLER
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    
    const resolvedParams = await params;const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const prisma = getScopedPrismaClient(session.user.tenantId);

    const data = await request.json();
    const validatedData = productUpdateSchema.parse(data);

    const currentProduct = await prisma.product.findUnique({
      where: { id: resolvedParams.productId },
    });

    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // --- PERMISSION CHECKS ---
    const hasProductEditPermission = session.user.role === 'ADMIN' || session.user.permissions?.includes('EDIT_PRODUCTS');
    const stockIsChanging = currentProduct.stock !== validatedData.stock;
    const detailsAreChanging = currentProduct.name !== validatedData.name || currentProduct.price !== validatedData.price;

    if (stockIsChanging) {
        return NextResponse.json(
          { error: 'Stock is controlled by the platform owner and cannot be changed from product editing.' },
          { status: 403 },
        );
    }
    if (detailsAreChanging && !hasProductEditPermission) {
        return new NextResponse('Forbidden: You do not have permission to edit product details.', { status: 403 });
    }
    // --- END PERMISSION CHECKS ---

    const product = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: resolvedParams.productId },
        data: {
          name: validatedData.name,
          description: validatedData.description,
          price: validatedData.price,
          lowStockAlert: validatedData.lowStockAlert,
        },
      });
      return updatedProduct;
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// --- FIX: SECURED SOFT DELETE HANDLER ---
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    
    const resolvedParams = await params;const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    // Permission Check
    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('DELETE_PRODUCTS')) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);

    // Instead of deleting, we update the `isActive` flag to false.
    await prisma.product.update({
      where: { id: resolvedParams.productId },
      data: { isActive: false },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
