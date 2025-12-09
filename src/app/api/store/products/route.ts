// src/app/api/store/products/route.ts

import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const storeProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be >= 0'),
  stock: z.number().min(0, 'Stock must be >= 0'),
  sku: z.string().min(2, 'SKU must be at least 2 characters').max(50),
});

// GET - List all store products (accessible by all authenticated users)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const products = await prisma.storeProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching store products:', error);
    return NextResponse.json({ error: 'Failed to fetch store products' }, { status: 500 });
  }
}

// POST - Create store product (Super Admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'SUPER_ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const data = await request.json();
    const validatedData = storeProductSchema.parse(data);

    // Check if SKU already exists
    const existingProduct = await prisma.storeProduct.findUnique({
      where: { sku: validatedData.sku },
    });

    if (existingProduct) {
      return NextResponse.json({ error: 'SKU already exists' }, { status: 400 });
    }

    const product = await prisma.storeProduct.create({
      data: validatedData,
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error creating store product:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create store product' }, { status: 500 });
  }
}
