import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        
    const resolvedParams = await params;const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Tenant-scoped client: stock history (incl. employee names/emails) is
        // only ever returned for products owned by the caller's tenant.
        const prisma = getScopedPrismaClient(session.user.tenantId);

        const stockAdjustments = await prisma.stockAdjustment.findMany({
            where: {
                productId: resolvedParams.productId,
            },
            include: {
                adjustedBy: {
                    select: {
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json(stockAdjustments);
    } catch (error) {
        console.error('Error fetching stock history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch stock history' },
            { status: 500 }
        );
    }
} 