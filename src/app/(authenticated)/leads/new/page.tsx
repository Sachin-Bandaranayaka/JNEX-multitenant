// src/app/(authenticated)/leads/new/page.tsx

import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, ArrowRightIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { LeadForm } from '@/components/leads/lead-form';
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
        <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        {prefilledLead ? 'Confirm Order' : 'New Order'}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {prefilledLead 
                            ? 'Finalize customer and product details to confirm the order' 
                            : 'Customer Form — capture the customer and product details'
                        }
                    </p>
                </div>
                <Link
                    href={returnTo}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-white px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    <ArrowLeftIcon className="mr-2 h-4 w-4" />
                    Back to Leads
                </Link>
            </div>

            <div className="genzo-card overflow-hidden">
                <div className="p-2 sm:p-3">
                    <LeadForm
                        products={products}
                        prefilledLead={prefilledLead || undefined}
                        returnTo={returnTo}
                        hasTransExpress={Boolean(tenant?.transExpressApiKey)}
                    />
                </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-col gap-3 border-b border-border bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                            <CheckCircleIcon className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="font-semibold text-foreground">Confirmed today</h2>
                            <p className="text-sm text-muted-foreground">
                                {confirmedTodayCount} order{confirmedTodayCount === 1 ? '' : 's'} ready for bulk fulfillment
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/orders?status=CONFIRMED"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        Open fulfillment queue
                        <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                </div>

                {recentConfirmedOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/20 text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <tr>
                                    <th className="px-5 py-3 font-medium">Order</th>
                                    <th className="px-5 py-3 font-medium">Customer</th>
                                    <th className="px-5 py-3 font-medium">Product</th>
                                    <th className="px-5 py-3 text-right font-medium">Total</th>
                                    <th className="px-5 py-3 text-right font-medium">Confirmed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {recentConfirmedOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td className="px-5 py-3 font-semibold text-foreground">#{order.number}</td>
                                        <td className="px-5 py-3 text-foreground">{order.customerName}</td>
                                        <td className="px-5 py-3 text-muted-foreground">{order.product.name}</td>
                                        <td className="px-5 py-3 text-right font-medium text-foreground">Rs. {order.total.toLocaleString('en-LK')}</td>
                                        <td className="px-5 py-3 text-right text-muted-foreground">
                                            {order.createdAt.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                        Confirmed orders will collect here while you continue processing leads.
                    </p>
                )}
            </section>
        </div>
    );
}
