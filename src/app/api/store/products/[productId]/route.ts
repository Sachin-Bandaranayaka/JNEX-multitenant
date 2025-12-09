// src/app/api/store/products/[productId]/route.ts

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const updateProductSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  stock: z.number().min(0).optional(),
  sku: z.string().min(2).max(50).optional(),
  isActive: z.boolean().optional(),
});

// GET - Get single store product
export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { productId } = await params;
    const product = await prisma.storeProduct.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching store product:', error);
    return NextResponse.json({ error: 'Failed to fetch store product' }, { status: 500 });
  }
}

// PUT - Update store product (Super Admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { productId } = await params;
    const data = await request.json();
    const validatedData = updateProductSchema.parse(data);

    // Check if SKU is being changed and if it already exists
    if (validatedData.sku) {
      const existingProduct = await prisma.storeProduct.findFirst({
        where: { sku: validatedData.sku, NOT: { id: productId } },
      });
      if (existingProduct) {
        return NextResponse.json({ error: 'SKU already exists' }, { status: 400 });
      }
    }

    const product = await prisma.storeProduct.update({
      where: { id: productId },
      data: validatedData,
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating store product:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update store product' }, { status: 500 });
  }
}

// DELETE - Soft delete store product (Super Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { productId } = await params;
    await prisma.storeProduct.update({
      where: { id: productId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting store product:', error);
    return NextResponse.json({ error: 'Failed to delete store product' }, { status: 500 });
  }
}
