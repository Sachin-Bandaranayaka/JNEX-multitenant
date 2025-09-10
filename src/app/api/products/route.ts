// src/app/api/products/route.ts

import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { transformProduct } from '@/lib/products'; // <-- Import our new helper

export const dynamic = 'force-dynamic';

// ... (keep the productSchema the same as before)
const productSchema = z.object({
    code: z.string().min(2, 'Code must be at least 2 characters').max(50, 'Code must be less than 50 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
    description: z.string().optional(),
    price: z.number().min(0, 'Price must be greater than or equal to 0').max(1000000, 'Price must be less than 1,000,000'),
    stock: z.number().min(0, 'Stock must be greater than or equal to 0').max(100000, 'Stock must be less than 100,000'),
    lowStockAlert: z.number().min(0, 'Low stock alert must be > 0').max(100000, 'Low stock alert must be < 100,000'),
});


export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const prisma = getScopedPrismaClient(session.user.tenantId);
    // ... (keep searchParams and where logic the same)
    const { searchParams } = new URL(request.url);
    const lowStock = searchParams.get('lowStock') === 'true';
    const search = searchParams.get('search');
    const where: Prisma.ProductWhereInput = {
      ...(search && { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] }),
    };


    const products = await prisma.product.findMany({
      where,
      include: {
        _count: { select: { orders: true, leads: true } },
        stockAdjustments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { code: 'asc' },
    });

    // Use the helper function to transform the data
    const transformedProducts = products.map(transformProduct);

    const filteredProducts = lowStock
      ? transformedProducts.filter(p => p.stock <= p.lowStockAlert)
      : transformedProducts;

    return NextResponse.json(filteredProducts);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// ... (keep the POST function exactly the same as before)
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        const prisma = getScopedPrismaClient(session.user.tenantId);
        const data = await request.json();
        const validatedData = productSchema.parse(data);
        // Check for any existing product with the same code (active or inactive)
        const existingProduct = await prisma.product.findFirst({
            where: { 
                code: validatedData.code
            },
        });
        
        if (existingProduct && existingProduct.isActive) {
            return NextResponse.json({ error: 'Product code already exists for this tenant' }, { status: 400 });
        }
        
        const product = await prisma.$transaction(async (tx) => {
            let newProduct;
            
            if (existingProduct && !existingProduct.isActive) {
                // Reactivate the soft-deleted product with new data
                newProduct = await tx.product.update({
                    where: { id: existingProduct.id },
                    data: {
                        name: validatedData.name,
                        description: validatedData.description,
                        price: validatedData.price,
                        stock: validatedData.stock,
                        lowStockAlert: validatedData.lowStockAlert,
                        isActive: true,
                    },
                });
            } else {
                // Create new product
                newProduct = await tx.product.create({
                    data: {
                        code: validatedData.code,
                        name: validatedData.name,
                        description: validatedData.description,
                        price: validatedData.price,
                        stock: validatedData.stock,
                        lowStockAlert: validatedData.lowStockAlert,
                        tenant: {
                            connect: { id: session.user.tenantId },
                        },
                    },
                });
            }
            if (validatedData.stock > 0) {
                const stockReason = existingProduct && !existingProduct.isActive ? 'Product reactivated' : 'Initial stock';
                await tx.stockAdjustment.create({
                    data: {
                        quantity: validatedData.stock,
                        reason: stockReason,
                        previousStock: 0,
                        newStock: validatedData.stock,
                        tenant: {
                            connect: { id: session.user.tenantId },
                        },
                        product: {
                            connect: { id: newProduct.id },
                        },
                        adjustedBy: {
                            connect: { id: session.user.id },
                        },
                    },
                });
            }
            return newProduct;
        });
        return NextResponse.json(product);
    } catch (error) {
        console.error('Error creating product:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
    }
}