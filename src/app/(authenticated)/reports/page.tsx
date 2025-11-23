import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ReportTabs } from '@/components/reports/report-tabs';
import { Metadata } from 'next';
import { User } from 'next-auth';
import {
    ShoppingBagIcon,
    CubeIcon,
    UsersIcon,
    TruckIcon
} from '@heroicons/react/24/outline';

export const metadata: Metadata = {
    title: 'Reports',
    description: 'View and analyze your business performance'
};

export default async function ReportsPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

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
        <div className="space-y-8 p-4 sm:p-6 lg:p-8">
            <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Reports</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    View and analyze your business performance
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="bg-card rounded-3xl border border-border shadow-sm p-6 flex items-center gap-4 transition-all hover:shadow-md">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                        <ShoppingBagIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-muted-foreground">Total Orders</div>
                        <div className="mt-1 text-3xl font-bold text-foreground">{totalOrders}</div>
                    </div>
                </div>
                <div className="bg-card rounded-3xl border border-border shadow-sm p-6 flex items-center gap-4 transition-all hover:shadow-md">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <CubeIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-muted-foreground">Active Products</div>
                        <div className="mt-1 text-3xl font-bold text-foreground">{totalProducts}</div>
                    </div>
                </div>
                <div className="bg-card rounded-3xl border border-border shadow-sm p-6 flex items-center gap-4 transition-all hover:shadow-md">
                    <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        <UsersIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-muted-foreground">Total Leads</div>
                        <div className="mt-1 text-3xl font-bold text-foreground">{totalLeads}</div>
                    </div>
                </div>
                <div className="bg-card rounded-3xl border border-border shadow-sm p-6 flex items-center gap-4 transition-all hover:shadow-md">
                    <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <TruckIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-muted-foreground">Total Shipments</div>
                        <div className="mt-1 text-3xl font-bold text-foreground">{totalShipments}</div>
                    </div>
                </div>
            </div>

            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
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