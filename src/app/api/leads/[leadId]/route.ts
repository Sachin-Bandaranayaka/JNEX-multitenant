import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

const leadUpdateSchema = z.object({
  productCode: z.string(),
  csvData: z.any(),
});
import { Prisma } from '@prisma/client';

// ... (GET and PUT handlers remain the same) ...

// --- FIX: Add a DELETE handler for leads ---
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    // Check for specific delete permission
    const canDelete = session.user.role === 'ADMIN' || session.user.permissions?.includes('DELETE_LEADS');
    if (!canDelete) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const resolvedParams = await params;
    const prisma = getScopedPrismaClient(session.user.tenantId);

    // Check if the lead has been converted to an order
    const lead = await prisma.lead.findUnique({
      where: { id: resolvedParams.leadId },
      include: { order: true },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.order) {
      return NextResponse.json({ error: 'Cannot delete a lead that has been converted to an order.' }, { status: 400 });
    }

    await prisma.lead.delete({
      where: { id: resolvedParams.leadId },
    });

    // Return a successful response with no content
    return new NextResponse(null, { status: 204 });

  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}

// SECURED GET HANDLER
export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const resolvedParams = await params;
    // Use the scoped client
    const prisma = getScopedPrismaClient(session.user.tenantId);

    // This query is now secure. It will only find the lead if it belongs to the current tenant.
    const lead = await prisma.lead.findUnique({
      where: { id: resolvedParams.leadId },
      include: {
        product: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        order: { include: { product: true } }
      }
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // This extra check is still good for TEAM_MEMBER roles
    if (session.user.role !== 'ADMIN' && lead.userId !== session.user.id) {
      return NextResponse.json({ error: 'You do not have permission' }, { status: 403 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
}

// SECURED PUT HANDLER
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    const resolvedParams = await params;
    // Use the scoped client for all operations
    const prisma = getScopedPrismaClient(session.user.tenantId);

    const data = await request.json();
    const validatedData = leadUpdateSchema.parse(data);

    // Securely get the lead to check permissions and status
    const lead = await prisma.lead.findUnique({
      where: { id: resolvedParams.leadId },
    });

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN' && lead.userId !== session.user.id) {
      return NextResponse.json({ error: 'You do not have permission' }, { status: 403 });
    }
    
    if (lead.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending leads can be edited' }, { status: 400 });
    }

    // **THE FIX**: Securely find the product within the tenant's scope
    const product = await prisma.product.findFirst({
      where: { 
        code: validatedData.productCode,
        isActive: true
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found for this tenant' }, { status: 404 });
    }

    // Securely update the lead
    const updatedLead = await prisma.lead.update({
      where: { id: resolvedParams.leadId },
      data: {
        csvData: validatedData.csvData as unknown as Prisma.JsonObject,
        productCode: validatedData.productCode,
      },
      include: {
        product: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        order: { include: { product: true } }
      },
    });

    return NextResponse.json(updatedLead);
  } catch (error) {
    console.error('Error updating lead:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}