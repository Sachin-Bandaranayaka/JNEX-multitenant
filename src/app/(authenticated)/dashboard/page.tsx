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
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const weekStart = new Date(new Date().setDate(now.getDate() - 6));
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    
    const monthStart = new Date(new Date().setMonth(now.getMonth() - 1));
    monthStart.setHours(0, 0, 0, 0);
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    // Fetch data going back 2 months to cover previous period comparisons
    const [orders, allTimeLeads, products] = await Promise.all([
        prisma.order.findMany({
            where: { createdAt: { gte: prevMonthStart } },
            select: { total: true, createdAt: true }
        }),
        prisma.lead.findMany({
            select: { status: true, createdAt: true }
        }),
        prisma.product.findMany({
            where: { isActive: true },
            select: { stock: true, lowStockAlert: true }
        })
    ]);

    const noStockCount = products.filter(p => p.stock <= 0).length;
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.lowStockAlert).length;

    const calculateStats = (startDate: Date, endDate?: Date) => {
        const periodOrders = orders.filter(o => {
            const date = new Date(o.createdAt);
            return date >= startDate && (!endDate || date < endDate);
        });
        const periodLeads = allTimeLeads.filter(l => {
            const date = new Date(l.createdAt);
            return date >= startDate && (!endDate || date < endDate);
        });
        const periodConvertedLeads = periodLeads.filter(l => l.status === LeadStatus.CONFIRMED);

        const orderCount = periodOrders.length;
        const revenue = periodOrders.reduce((sum, order) => sum + order.total, 0);
        const leadCount = periodLeads.length;
        const conversionRate = periodLeads.length > 0 ? (periodConvertedLeads.length / periodLeads.length) * 100 : 0;

        return {
            orders: orderCount,
            revenue,
            leads: leadCount,
            conversionRate,
            avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
        };
    };

    const calculatePercentChange = (current: number, previous: number): number | null => {
        if (previous === 0) return current > 0 ? 100 : null;
        return ((current - previous) / previous) * 100;
    };

    const buildPeriodData = (currentStart: Date, prevStart: Date, prevEnd: Date) => {
        const current = calculateStats(currentStart);
        const previous = calculateStats(prevStart, prevEnd);
        
        return {
            ...current,
            changes: {
                orders: calculatePercentChange(current.orders, previous.orders),
                revenue: calculatePercentChange(current.revenue, previous.revenue),
                leads: calculatePercentChange(current.leads, previous.leads),
                conversionRate: calculatePercentChange(current.conversionRate, previous.conversionRate),
                avgOrderValue: calculatePercentChange(current.avgOrderValue, previous.avgOrderValue),
            }
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

    return {
        daily: buildPeriodData(todayStart, yesterdayStart, todayStart),
        weekly: buildPeriodData(weekStart, prevWeekStart, weekStart),
        monthly: buildPeriodData(monthStart, prevMonthStart, monthStart),
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
