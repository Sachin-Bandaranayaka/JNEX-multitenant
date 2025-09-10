// src/app/api/leads/import/route.ts

import { getScopedPrismaClient } from '@/lib/prisma';
import { LeadSchema } from '@/lib/csv-parser'; // This is the schema for a single lead from CSV
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Define schemas for the two possible actions: 'preview' and 'import'
const PreviewPayloadSchema = z.object({
  action: z.literal('preview'),
  leads: z.array(LeadSchema),
});

const ImportPayloadSchema = z.object({
  action: z.literal('import'),
  leads: z.array(LeadSchema), // The frontend will send only the valid leads for the final import
});

// Create a union schema to validate the request body
const RequestSchema = z.union([PreviewPayloadSchema, ImportPayloadSchema]);

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const tenantId = session.user.tenantId;
    const prisma = getScopedPrismaClient(tenantId);
    const json = await request.json();

    // Validate the incoming request to see if it's a 'preview' or 'import' action
    let payload;
    try {
      payload = RequestSchema.parse(json);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log('Lead import validation error:', JSON.stringify(error.issues, null, 2));
        console.log('Problematic data at error path:', JSON.stringify(json, null, 2));
        
        // Extract the specific row that failed
        const issue = error.issues[0];
        if (issue.path.includes('leads') && issue.path.length >= 2) {
          const rowIndex = issue.path[1];
          const fieldName = issue.path[2];
          console.log(`Row ${rowIndex} (${fieldName}):`, json.leads?.[rowIndex]);
        }
      }
      throw error;
    }

    // --- ACTION 1: PREVIEW THE CSV DATA ---
    if (payload.action === 'preview') {
      const { leads } = payload;

      // 1. Get all unique product codes from the uploaded leads to check against the DB.
      const productCodes = [...new Set(leads.map(lead => lead.product_code?.toUpperCase()).filter(Boolean))];

      // 2. Fetch all corresponding products with their stock and low stock alert levels.
      const productsFromDb = await prisma.product.findMany({
        where: {
          code: {
            in: productCodes,
            mode: 'insensitive', // Case-insensitive check
          },
        },
        select: { code: true, stock: true, lowStockAlert: true },
      });

      // 3. Create a Map for efficient product lookups.
      const productMap = new Map(
        productsFromDb.map(p => [p.code.toUpperCase(), p])
      );

      // 4. Analyze each lead and assign a stock status.
      const previewResults = leads.map(lead => {
        const productCodeUpper = lead.product_code?.toUpperCase();
        const product = productCodeUpper ? productMap.get(productCodeUpper) : undefined;

        let status: 'OK_TO_IMPORT' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'INVALID_PRODUCT';

        if (!product) {
          status = 'INVALID_PRODUCT';
        } else if (product.stock <= 0) {
          status = 'OUT_OF_STOCK';
        } else if (product.stock <= product.lowStockAlert) {
          status = 'LOW_STOCK';
        } else {
          status = 'OK_TO_IMPORT';
        }

        return { data: lead, status };
      });

      // 5. Return the full preview list to the frontend.
      return NextResponse.json({ preview: previewResults });
    }

    // --- ACTION 2: IMPORT THE CONFIRMED LEADS ---
    if (payload.action === 'import') {
      const { leads } = payload; // These leads are pre-filtered by the frontend.

      const createdLeads = await prisma.$transaction(
        leads.map(lead => {
          const csvData = { ...lead, name: lead.customer_name };
          return prisma.lead.create({
            data: {
              csvData: csvData as unknown as Prisma.JsonObject,
              status: 'PENDING',
              assignedTo: { connect: { id: session.user.id } },
              tenant: { connect: { id: tenantId } },
              product: {
                connect: {
                  code_tenantId: {
                    code: lead.product_code,
                    tenantId: tenantId,
                  },
                },
              },
            }
          });
        })
      );

      return NextResponse.json({
        message: `Successfully imported ${createdLeads.length} leads.`,
        count: createdLeads.length
      });
    }

  } catch (error) {
    console.error('Lead import error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 });
  }
}
