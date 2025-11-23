import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { User } from 'next-auth';
import { ShippingList } from '@/components/shipping/shipping-list';

export default async function ShippingTrackingPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    const user = session.user as User;

    // --- FIX: Check for the specific VIEW_SHIPPING permission ---
    const canViewAll = user.role === 'ADMIN' || user.permissions?.includes('VIEW_SHIPPING');

    // This check is optional but recommended. If a user has no business on this page, redirect them.
    if (!canViewAll) {
        return redirect('/unauthorized');
    }

    const prisma = getScopedPrismaClient(user.tenantId);

    // --- FIX: Update the query to respect the VIEW_SHIPPING permission ---
    const where: Prisma.OrderWhereInput = {
        status: 'SHIPPED',
        shippingProvider: { not: null },
        trackingNumber: { not: null },
        // Only filter by user ID if the user is a TEAM_MEMBER AND they DON'T have permission to view all.
        ...(!canViewAll && user.role === 'TEAM_MEMBER' ? { userId: user.id } : {}),
    };

    const shippedOrders = await prisma.order.findMany({
        where,
        include: {
            product: true,
            assignedTo: true,
        },
        orderBy: {
            shippedAt: 'desc',
        },
    });

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Shipping Tracking</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Track all your shipped orders in one place</p>
                </div>
            </div>

            <ShippingList orders={shippedOrders} />
        </div>
    );
}