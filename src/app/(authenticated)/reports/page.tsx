import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ReportTabs } from '@/components/reports/report-tabs';
import { Metadata } from 'next';
import { User } from 'next-auth'; // Import User type

export const metadata: Metadata = {
    title: 'Reports',
    description: 'View and analyze your business performance'
};

export default async function ReportsPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    // This check correctly allows users with VIEW_REPORTS to see the page
    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('VIEW_REPORTS')) {
        return redirect('/unauthorized');
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);

    const [totalOrders, totalProducts, totalLeads, totalShipments] = await Promise.all([
        prisma.order.count(),
        prisma.product.count(),
        prisma.lead.count(),
        prisma.order.count({ where: { shippingProvider: { not: null } } })
    ]);

    const shippingStats = await prisma.order.groupBy({
        by: ['shippingProvider'],
        where: { shippingProvider: { not: null } },
        _count: true
    });

    const transformedShippingStats = shippingStats.reduce((acc, stat) => {
        if (stat.shippingProvider) {
            acc[stat.shippingProvider] = stat._count;
        }
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6 p-4 sm:p-6 bg-background">
            <div>
                <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    View and analyze your business performance
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-card rounded-lg p-6 ring-1 ring-border">
                    <div className="text-sm font-medium text-muted-foreground">Total Orders</div>
                    <div className="mt-2 text-3xl font-semibold text-card-foreground">{totalOrders}</div>
                </div>
                <div className="bg-card rounded-lg p-6 ring-1 ring-border">
                    <div className="text-sm font-medium text-muted-foreground">Active Products</div>
                    <div className="mt-2 text-3xl font-semibold text-card-foreground">{totalProducts}</div>
                </div>
                <div className="bg-card rounded-lg p-6 ring-1 ring-border">
                    <div className="text-sm font-medium text-muted-foreground">Total Leads</div>
                    <div className="mt-2 text-3xl font-semibold text-card-foreground">{totalLeads}</div>
                </div>
                <div className="bg-card rounded-lg p-6 ring-1 ring-border">
                    <div className="text-sm font-medium text-muted-foreground">Total Shipments</div>
                    <div className="mt-2 text-3xl font-semibold text-card-foreground">{totalShipments}</div>
                </div>
            </div>

            <div className="bg-card rounded-lg ring-1 ring-border overflow-hidden">
                {/* --- FIX: Pass the user object to the client component --- */}
                <ReportTabs
                    user={session.user as User}
                    initialData={{
                        totalOrders,
                        totalProducts,
                        totalLeads,
                        totalShipments,
                        shippingStats: transformedShippingStats
                    }}
                />
            </div>
        </div>
    );
}