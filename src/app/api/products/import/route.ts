// src/app/api/products/import/route.ts

import { getScopedPrismaClient } from '@/lib/prisma'; // Import our scoped client
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parse } from 'papaparse';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

const productImportSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(50, 'Code must be less than 50 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be >= 0').max(1000000, 'Price must be < 1,000,000'),
  stock: z.number().min(0, 'Stock must be >= 0').max(100000, 'Stock must be < 100,000'),
  lowStockAlert: z.number().min(0, 'Low stock alert must be >= 0').max(100000, 'Low stock alert must be < 100,000'),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // 1. SECURE THE ROUTE: Check for session and tenantId
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. USE THE SCOPED CLIENT: All DB operations from here are tenant-aware
    const prisma = getScopedPrismaClient(session.user.tenantId);

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const csvText = await file.text();
    const { data, errors } = parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transform: (value) => (value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined' || value === '' ? null : value),
      transformHeader: (header) => header.toLowerCase().trim(),
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: 'Invalid CSV format', details: errors }, { status: 400 });
    }

    const results = {
      total: data.length,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const row of data) {
      try {
        const productData = {
          code: String((row as any).code),
          name: String((row as any).name),
          description: (row as any).description ? String((row as any).description) : undefined,
          price: Number((row as any).price),
          stock: Number((row as any).stock || 0),
          lowStockAlert: Number((row as any).lowstockalert || (row as any)['low stock alert'] || 5),
        };

        const validatedData = productImportSchema.parse(productData);

        // 3. SECURE THE CHECK: This now checks for the product code ONLY within the current tenant's products
        const existingProduct = await prisma.product.findFirst({
          where: { 
            code: validatedData.code
          },
        });

        if (existingProduct) {
          // 4. SECURE THE UPDATE: This transaction will update or reactivate products belonging to the current tenant
          await prisma.$transaction(async (tx) => {
            const updatedProduct = await tx.product.update({
              where: { id: existingProduct.id }, // Update by the globally unique ID
              data: {
                name: validatedData.name,
                description: validatedData.description,
                price: validatedData.price,
                stock: validatedData.stock,
                lowStockAlert: validatedData.lowStockAlert,
                isActive: true, // Reactivate if it was soft-deleted
              },
            });

            if (existingProduct.stock !== validatedData.stock) {
              const adjustmentReason = !existingProduct.isActive ? 'CSV import reactivation' : 'CSV import update';
              await tx.stockAdjustment.create({
                data: {
                  quantity: validatedData.stock - existingProduct.stock,
                  reason: adjustmentReason,
                  previousStock: existingProduct.stock,
                  newStock: validatedData.stock,
                  tenant: {
                    connect: { id: session.user.tenantId },
                  },
                  product: {
                    connect: { id: updatedProduct.id },
                  },
                  adjustedBy: {
                    connect: { id: session.user.id },
                  },
                },
              });
            }
          });
          results.updated++;
        } else {
          // 5. SECURE THE CREATE: This transaction automatically assigns the new product to the current tenant
          await prisma.$transaction(async (tx) => {
            const newProduct = await tx.product.create({
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

            if (validatedData.stock > 0) {
              await tx.stockAdjustment.create({
                data: {
                  quantity: validatedData.stock,
                  reason: 'CSV import creation',
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
          });
          results.created++;
        }
      } catch (error) {
        results.failed++;
        const rowIdentifier = (row as any).code || `Row ${results.created + results.updated + results.failed}`;
        results.errors.push(
          `Row ${rowIdentifier}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error importing products:', error);
    return NextResponse.json({ error: 'Failed to import products' }, { status: 500 });
  }
}