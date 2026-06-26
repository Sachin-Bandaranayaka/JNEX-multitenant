import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getScopedPrismaClient } from '@/lib/prisma';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for validating request body
const UpdateInvoicePrintStatusSchema = z.object({
    printed: z.boolean(),
});

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        
    const resolvedParams = await params;// Check authentication
        const session = await getSession();
        if (!session?.user?.tenantId) {
            return NextResponse.json(
                { error: 'You must be logged in to update invoice print status' },
                { status: 401 }
            );
        }

        // Tenant-scoped client: only orders owned by the caller's tenant can be
        // marked printed; a cross-tenant orderId resolves to no record.
        const prisma = getScopedPrismaClient(session.user.tenantId);

        // Parse and validate the request body
        const body = await request.json();
        const validation = UpdateInvoicePrintStatusSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid request data', details: validation.error.format() },
                { status: 400 }
            );
        }

        const { printed } = validation.data;
        const orderId = resolvedParams.orderId;

        // Update invoice print status in the database
        const updatedOrder = await prisma.order.update({
            where: { id: orderId },
            data: { invoicePrinted: printed },
        });

        return NextResponse.json(updatedOrder);
    } catch (error) {
        console.error('Error updating invoice print status:', error);
        return NextResponse.json(
            { error: 'Failed to update invoice print status' },
            { status: 500 }
        );
    }
} 