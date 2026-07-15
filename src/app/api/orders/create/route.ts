// src/app/api/orders/create/route.ts

import { createOrderFromLead } from '@/lib/orders';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma as unscopedPrisma } from '@/lib/prisma';
import { LeadStatus } from '@prisma/client'; // Import LeadStatus

export const dynamic = 'force-dynamic';

const CreateOrderSchema = z.object({
  leadId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  forceCreate: z.boolean().optional().default(false),
  shippingLocation: z.object({
    provider: z.literal('TRANS_EXPRESS'),
    districtId: z.number().int().positive(),
    districtName: z.string().trim().min(1),
    cityId: z.number().int().positive(),
    cityName: z.string().trim().min(1),
  }).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const json = await request.json();
    const { leadId, quantity, forceCreate, shippingLocation } = CreateOrderSchema.parse(json);
    const currentTenantId = session.user.tenantId;

    const tenant = await unscopedPrisma.tenant.findUnique({
      where: { id: currentTenantId },
      select: { transExpressApiKey: true },
    });

    if (tenant?.transExpressApiKey && !shippingLocation) {
      return NextResponse.json(
        { error: 'Select a Trans Express district and city before confirming the order.' },
        { status: 400 }
      );
    }

    // 1. Get the details of the lead being converted
    const leadToConvert = await unscopedPrisma.lead.findUnique({
      where: { id: leadId },
      include: { product: true },
    });

    if (!leadToConvert) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Extract phone and product name from the lead
    const leadCsvData = leadToConvert.csvData as { phone?: string, name?: string };
    const leadPhone = leadCsvData?.phone;
    const leadProductName = leadToConvert.product.name;

    if (!leadPhone) {
        return NextResponse.json({ error: 'Lead has no phone number.' }, { status: 400 });
    }

    if (!forceCreate) {
        // 2. Calculate the date for one week ago
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // 3. Search for similar CONFIRMED LEADS in other tenants
        const potentialDuplicates = await unscopedPrisma.lead.findMany({
            where: {
                tenantId: {
                    not: currentTenantId, // Check all OTHER tenants
                },
                status: LeadStatus.CONFIRMED, // Check for CONFIRMED leads
                updatedAt: { // Use updatedAt as the confirmation date
                    gte: oneWeekAgo,
                },
                csvData: {
                    path: ['phone'],
                    equals: leadPhone,
                },
                product: {
                    name: {
                        contains: leadProductName,
                        mode: 'insensitive',
                    },
                },
            },
            select: {
                product: {
                    select: { name: true }
                },
                csvData: true, // Select the whole JSON to get customer name
                updatedAt: true,
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });

        if (potentialDuplicates.length > 0) {
            const formattedDuplicates = potentialDuplicates.map(lead => {
                const customerName = (lead.csvData as any)?.name || 'N/A';
                return {
                    productName: lead.product.name,
                    customerName: customerName,
                    confirmedDate: lead.updatedAt,
                };
            });

            return NextResponse.json({
                requiresConfirmation: true,
                potentialDuplicates: formattedDuplicates,
            });
        }
    }

    // If no duplicates are found (or if forceCreate is true), create the order.
    const order = await createOrderFromLead({
      leadId,
      userId: session.user.id,
      quantity,
      tenantId: currentTenantId,
      shippingLocation,
    });

    return NextResponse.json({ ...order, requiresConfirmation: false });

  } catch (error) {
    console.error('Order creation error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create order' }, { status: 500 });
  }
}
