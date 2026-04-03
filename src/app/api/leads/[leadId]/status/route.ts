import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const statusSchema = z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'NO_ANSWER', 'REJECTED']),
});

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ leadId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const resolvedParams = await params;
        const data = await request.json();
        const validatedData = statusSchema.parse(data);

        // Get the lead and verify it exists
        const lead = await prisma.lead.findUnique({
            where: { id: resolvedParams.leadId },
        });

        if (!lead) {
            return NextResponse.json(
                { error: 'Lead not found' },
                { status: 404 }
            );
        }

        // Check if user has access to this lead
        if (session.user.role !== 'ADMIN' && lead.userId !== session.user.id) {
            return NextResponse.json(
                { error: 'You do not have permission to update this lead' },
                { status: 403 }
            );
        }

        // Update lead status (and increment callAttempts when marking as NO_ANSWER)
        const updatedLead = await prisma.lead.update({
            where: { id: resolvedParams.leadId },
            data: {
                status: validatedData.status,
                ...(validatedData.status === 'NO_ANSWER' ? { callAttempts: { increment: 1 } } : {}),
            },
            include: {
                product: true,
                assignedTo: true,
                order: true,
            },
        });

        return NextResponse.json(updatedLead);
    } catch (error) {
        console.error('Error updating lead status:', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Invalid status', details: error.errors },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to update lead status' },
            { status: 500 }
        );
    }
}