// src/app/(authenticated)/dashboard/page.tsx

import { getSession } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { LeadStatus } from "@prisma/client";

async function getDashboardData(tenantId: string) {
    const prisma = getScopedPrismaClient(tenantId);

    const now = new Date();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const weekStart = new Date(new Date().setDate(now.getDate() - 6));
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(new Date().setMonth(now.getMonth() - 1));
    monthStart.setHours(0, 0, 0, 0);

    // --- FIX: Fetch products in parallel to calculate stock counts ---
    const [orders, allTimeLeads, products] = await Promise.all([
        prisma.order.findMany({
            where: { createdAt: { gte: monthStart } },
            select: { total: true, createdAt: true }
        }),
        prisma.lead.findMany({
            select: { status: true, createdAt: true }
        }),
        // Fetch product stock data to calculate counts
        prisma.product.findMany({
            where: { isActive: true },
            select: { stock: true, lowStockAlert: true }
        })
    ]);

    // --- NEW: Calculate stock counts from the fetched products ---
    const noStockCount = products.filter(p => p.stock <= 0).length;
    // Low stock items have stock but are at or below the alert level
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.lowStockAlert).length;

    const calculateStats = (startDate: Date) => {
        const periodOrders = orders.filter(o => new Date(o.createdAt) >= startDate);
        const periodLeads = allTimeLeads.filter(l => new Date(l.createdAt) >= startDate);
        const periodConvertedLeads = periodLeads.filter(l => l.status === LeadStatus.CONFIRMED);

        return {
            orders: periodOrders.length,
            revenue: periodOrders.reduce((sum, order) => sum + order.total, 0),
            leads: periodLeads.length,
            conversionRate: periodLeads.length > 0 ? (periodConvertedLeads.length / periodLeads.length) * 100 : 0,
        };
    };

    const leadsByStatus = allTimeLeads.reduce((acc, lead) => {
        const statusKey = lead.status.charAt(0).toUpperCase() + lead.status.slice(1).toLowerCase();
        const existing = acc.find(item => item.status === statusKey);
        if (existing) {
            existing.count++;
        } else {
            acc.push({ status: statusKey, count: 1 });
        }
        return acc;
    }, [] as { status: string; count: number }[]);

    const totalLeads = allTimeLeads.length;
    const convertedLeads = allTimeLeads.filter(l => l.status === LeadStatus.CONFIRMED).length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    // --- FIX: Add the new stock counts to the return object ---
    return {
        daily: calculateStats(todayStart),
        weekly: calculateStats(weekStart),
        monthly: calculateStats(monthStart),
        allTime: {
            totalLeads,
            convertedLeads,
            conversionRate,
        },
        leadsByStatus,
        noStockCount,
        lowStockCount,
    };
}

export default async function DashboardPage() {
    const session = await getSession();

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('VIEW_DASHBOARD')) {
        return redirect('/unauthorized');
    }

    const dashboardData = await getDashboardData(session.user.tenantId);

    // --- FIX: Pass the complete data object to the client component ---
    return <DashboardClient initialData={dashboardData} userName={session.user.name} />;
}
