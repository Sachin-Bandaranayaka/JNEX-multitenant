// src/app/(authenticated)/leads/new/page.tsx

import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LeadForm } from '@/components/leads/lead-form';
import { RecentConfirmedOrders } from '@/components/leads/recent-confirmed-orders';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'New Lead',
    description: 'Add a new lead to the system'
};

export default async function NewLeadPage({
    searchParams,
}: {
    searchParams: Promise<{ leadId?: string; returnTo?: string }>;
}) {
    const resolvedParams = await searchParams;
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    // Confirming an imported lead is an order action; opening the blank form is
    // a lead-creation action. Keep those permissions independent.
    const requiredPermission = resolvedParams.leadId ? 'CREATE_ORDERS' : 'CREATE_LEADS';
    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes(requiredPermission)) {
        return redirect('/unauthorized');
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const orderVisibility = session.user.role === 'TEAM_MEMBER' && !session.user.permissions?.includes('VIEW_ORDERS')
        ? { userId: session.user.id }
        : {};

    const [products, confirmedTodayCount, recentConfirmedOrders, tenant] = await Promise.all([
        prisma.product.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
        }),
        prisma.order.count({
            where: {
                status: 'CONFIRMED',
                createdAt: { gte: startOfToday, lt: startOfTomorrow },
                ...orderVisibility,
            },
        }),
        prisma.order.findMany({
            where: {
                status: 'CONFIRMED',
                createdAt: { gte: startOfToday, lt: startOfTomorrow },
                ...orderVisibility,
            },
            select: {
                id: true,
                number: true,
                customerName: true,
                total: true,
                createdAt: true,
                product: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
        }),
        // The confirmation form only needs to know whether Trans Express is
        // available; credentials never leave the server.
        globalPrisma.tenant.findUnique({
            where: { id: session.user.tenantId },
            select: { transExpressApiKey: true },
        }),
    ]);

    const returnTo = resolvedParams.returnTo && /^\/leads(?:\?|$)/.test(resolvedParams.returnTo)
        ? resolvedParams.returnTo
        : '/leads';

    let prefilledLead = null;
    if (resolvedParams.leadId) {
        const lead = await prisma.lead.findUnique({
            where: { id: resolvedParams.leadId },
            include: { product: true },
        });
        if (lead) {
            prefilledLead = {
                id: lead.id,
                productCode: lead.productCode,
                product: {
                    id: lead.product.id,
                    name: lead.product.name,
                    code: lead.product.code,
                    price: lead.product.price,
                },
                csvData: lead.csvData as any,
            };
        }
    }

    return (
        <div className="mx-auto max-w-[1600px] space-y-5 p-3 sm:p-5 lg:p-6">
            <div className="overflow-visible border border-border bg-card shadow-sm">
                    <LeadForm
                        products={products}
                        prefilledLead={prefilledLead || undefined}
                        returnTo={returnTo}
                        hasTransExpress={Boolean(tenant?.transExpressApiKey)}
                    />
            </div>
            <RecentConfirmedOrders
                totalCount={confirmedTodayCount}
                orders={recentConfirmedOrders.map((order) => ({
                    id: order.id,
                    number: order.number,
                    customerName: order.customerName,
                    productName: order.product.name,
                    total: order.total,
                    confirmedAt: order.createdAt.toISOString(),
                }))}
            />
        </div>
    );
}
