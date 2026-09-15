// src/app/api/leads/import/route.ts

import { getScopedPrismaClient } from '@/lib/prisma';
import { LeadSchema } from '@/lib/csv-parser'; // This is the schema for a single lead from CSV
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requirePermission, requireTenantAdmin } from '@/lib/authz';

export const dynamic = 'force-dynamic';

// Define schemas for the two possible actions: 'preview' and 'import'
const PreviewPayloadSchema = z.object({
  action: z.literal('preview'),
  leads: z.array(LeadSchema),
});

const ImportPayloadSchema = z.object({
  action: z.literal('import'),
  leads: z.array(LeadSchema).min(1).max(5000),
  assigneeIds: z.array(z.string().uuid()).max(100).optional(),
});

// Create a union schema to validate the request body
const RequestSchema = z.union([PreviewPayloadSchema, ImportPayloadSchema]);

export async function POST(request: Request) {
  try {
    const guard = await requirePermission('CREATE_LEADS');
    if (!guard.ok) return guard.response;
    const session = guard.session;
    const tenantId = guard.tenantId;
    const prisma = getScopedPrismaClient(tenantId);
    const json = await request.json();

    const payload = RequestSchema.parse(json);

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
          isActive: true, // Ignore soft-deleted / retired products
        },
        select: { code: true, stock: true, lowStockAlert: true },
      });

      // 3. Create a Map for efficient product lookups.
      const productMap = new Map(
        productsFromDb.map(p => [p.code.toUpperCase(), p])
      );

      // 4. Analyze each lead and assign a stock status.
      const previewResults = leads.map((lead, index) => {
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
      const { leads } = payload;
      const selectedIds = [...new Set(payload.assigneeIds ?? [])];
      if (selectedIds.length > 0) {
        const adminGuard = await requireTenantAdmin();
        if (!adminGuard.ok) return adminGuard.response;
        if (adminGuard.tenantId !== tenantId) {
          return NextResponse.json({ error: 'Tenant access changed. Please reload.' }, { status: 403 });
        }
        const staff = await prisma.user.findMany({
          where: { id: { in: selectedIds }, tenantId, isActive: true, role: { not: 'SUPER_ADMIN' } },
          select: { id: true },
        });
        if (staff.length !== selectedIds.length) {
          return NextResponse.json({ error: 'One or more selected staff members are no longer available. Refresh the staff list.' }, { status: 400 });
        }
      }
      const assigneeIds = selectedIds.length ? selectedIds : [session.user.id];

      // Re-validate on the server: never trust the frontend-supplied list.
      // Only allow connecting to products that exist for THIS tenant and are active.
      const requestedCodes = [...new Set(leads.map(lead => lead.product_code?.toUpperCase()).filter(Boolean))];
      const activeProducts = await prisma.product.findMany({
        where: {
          code: { in: requestedCodes, mode: 'insensitive' },
          isActive: true,
        },
        select: { code: true },
      });
      const productCodes = new Map(activeProducts.map(p => [p.code.toUpperCase(), p.code]));
      const activeCodeSet = new Set(productCodes.keys());

      const invalidCodes = requestedCodes.filter(code => !activeCodeSet.has(code));
      if (invalidCodes.length > 0) {
        return NextResponse.json(
          {
            error: 'One or more leads reference a product that does not exist or is inactive for your account.',
            invalidCodes,
          },
          { status: 400 }
        );
      }

      await prisma.$transaction([
        ...leads.map((lead, index) => {
          const csvData = { 
            ...lead, 
            name: lead.customer_name,
            secondPhone: lead.second_phone || '',
            second_phone: lead.second_phone || '',
          };
          return prisma.lead.create({
            data: {
              csvData: csvData as unknown as Prisma.JsonObject,
              status: 'PENDING',
              assignedTo: { connect: { id: assigneeIds[index % assigneeIds.length] } },
              tenant: { connect: { id: tenantId } },
              product: {
                connect: {
                  code_tenantId: {
                    code: productCodes.get(lead.product_code.toUpperCase())!,
                    tenantId: tenantId,
                  },
                },
              },
            }
          });
        }),
        prisma.auditEvent.create({
          data: {
            tenantId,
            actorId: session.user.id,
            action: 'LEADS_IMPORTED',
            entityType: 'Lead',
            metadata: { leadCount: leads.length, assigneeIds },
          },
        }),
      ]);

      return NextResponse.json({
        message: `Successfully imported ${leads.length} leads.`,
        count: leads.length
      });
    }

    return NextResponse.json({ error: 'Unsupported import action' }, { status: 400 });
  } catch (error) {
    console.error('Lead import error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 });
  }
}
