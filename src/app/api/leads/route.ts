// src/app/api/leads/route.ts

import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { Prisma, LeadStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

// --- UPDATED: Add secondPhone to the schema ---
const leadSchema = z.object({
  csvData: z.object({
    name: z.string().min(1, 'Name is required'),
    phone: z.string().min(1, 'Phone number is required'),
    secondPhone: z.string().optional(), // New optional field
    email: z.string().email('Invalid email').optional().nullable(),
    address: z.string().min(1, 'Address is required'),
    city: z.string().optional().default(""),
    source: z.string().optional().default(""),
    notes: z.string().optional(),
  }),
  productCode: z.string().min(1, 'Product code is required'),
  forceCreate: z.boolean().optional().default(false),
});

// SECURED GET HANDLER (No changes)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as LeadStatus | null;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Prisma.LeadWhereInput = {
      ...(session.user.role !== 'ADMIN' && { userId: session.user.id }),
      ...(status && { status: status as LeadStatus }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const leads = await prisma.lead.findMany({
      where,
      include: {
        product: true,
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

// SECURED POST HANDLER
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);
    const data = await request.json();
    const validatedData = leadSchema.parse(data);

    const product = await prisma.product.findFirst({
      where: { 
        code: validatedData.productCode,
        isActive: true
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found for this tenant' }, { status: 404 });
    }

    if (product.stock <= 0) {
        return NextResponse.json({ error: `Product "${product.name}" is out of stock.` }, { status: 400 });
    }

    if (product.stock <= product.lowStockAlert && !validatedData.forceCreate) {
        return NextResponse.json({
            requiresConfirmation: true,
            message: `Low stock warning for "${product.name}". Only ${product.stock} items left. Do you want to proceed?`,
        });
    }
    
    const lead = await prisma.lead.create({
      data: {
        // The entire csvData object, including the new secondPhone, is saved as JSON
        csvData: validatedData.csvData as unknown as Prisma.JsonObject,
        status: 'PENDING' as LeadStatus,
        assignedTo: {
          connect: {
            id: session.user.id,
          },
        },
        tenant: {
          connect: {
            id: session.user.tenantId,
          },
        },
        product: {
          connect: {
            code_tenantId: {
              code: validatedData.productCode,
              tenantId: session.user.tenantId,
            },
          },
        },
      },
      include: {
        product: true,
        assignedTo: true,
      },
    });

    let notification: string | null = null;
    if (product.stock <= product.lowStockAlert) {
        notification = `Lead created, but product "${product.name}" is low on stock (${product.stock} left).`;
    }

    return NextResponse.json({ ...lead, notification });

  } catch (error) {
    console.error('Error creating lead:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
