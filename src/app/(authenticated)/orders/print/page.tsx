// src/app/(authenticated)/orders/print/page.tsx

import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PrintClient } from './print-client';
import { Tenant } from '@prisma/client';

export const dynamic = 'force-dynamic';

// --- FIX: The page now accepts `searchParams` to read the URL ---
interface PrintPageProps {
    searchParams: Promise<{
        ids?: string;
    }>;
}

export default async function PrintPage({ searchParams }: PrintPageProps) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    const canPrint = session.user.role === 'ADMIN' || session.user.permissions?.includes('CREATE_ORDERS') || session.user.permissions?.includes('EDIT_ORDERS');
    if (!canPrint) {
        return redirect('/unauthorized');
    }

    // --- FIX: Get the comma-separated IDs from the URL and split them into an array ---
    const resolvedSearchParams = await searchParams;
    const orderIds = resolvedSearchParams.ids ? resolvedSearchParams.ids.split(',') : [];

    // If no IDs are provided, show an empty state instead of fetching all orders.
    if (orderIds.length === 0) {
        return (
            <div className="text-center p-10 text-white">
                <h1 className="text-2xl font-bold">No Orders Selected</h1>
                <p className="mt-2 text-gray-400">Please go back to the orders page and select one or more orders to print.</p>
            </div>
        );
    }

    const scopedPrisma = getScopedPrismaClient(session.user.tenantId);

    // Fetch both the selected orders and the tenant's invoice details
    const [orders, tenant] = await Promise.all([
        scopedPrisma.order.findMany({
            // --- FIX: The 'where' clause now fetches only the selected order IDs ---
            where: {
                id: { in: orderIds },
            },
            include: {
                product: true,
            },
            // We can still order them by date
            orderBy: {
                createdAt: 'desc'
            }
        }),
        globalPrisma.tenant.findUnique({
            where: { id: session.user.tenantId }
        })
    ]);

    if (!tenant) {
        return <div>Error: Tenant information could not be loaded.</div>;
    }

    return (
        <PrintClient
            initialOrders={orders}
            tenant={tenant as Tenant}
        />
    );
}
