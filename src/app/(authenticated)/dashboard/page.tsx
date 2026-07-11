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
            select: { total: true, createdAt: true, status: true }
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

        const sumBy = (statuses: string[]) => periodOrders
            .filter(o => statuses.includes(o.status as string))
            .reduce((acc, o) => ({ count: acc.count + 1, total: acc.total + o.total }), { count: 0, total: 0 });
        const statusCounts = {
            total: { count: orderCount, total: revenue },
            pending: sumBy(['PENDING', 'CONFIRMED', 'RESCHEDULED']),
            shipped: sumBy(['SHIPPED']),
            returned: sumBy(['RETURNED', 'CANCELLED']),
            delivered: sumBy(['DELIVERED']),
        };

        return {
            statusCounts,
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

    // Fetch reminder data
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const [overdueReminders, todayReminders, upcomingReminders] = await Promise.all([
        prisma.lead.findMany({
            where: {
                reminderDate: { lt: todayStart },
                status: { in: ['PENDING', 'NO_ANSWER'] },
            },
            select: {
                id: true,
                csvData: true,
                reminderDate: true,
                reminderNote: true,
                product: { select: { name: true } },
                assignedTo: { select: { name: true } },
            },
            orderBy: { reminderDate: 'asc' },
            take: 10,
        }),
        prisma.lead.findMany({
            where: {
                reminderDate: { gte: todayStart, lte: todayEnd },
                status: { in: ['PENDING', 'NO_ANSWER'] },
            },
            select: {
                id: true,
                csvData: true,
                reminderDate: true,
                reminderNote: true,
                product: { select: { name: true } },
                assignedTo: { select: { name: true } },
            },
            orderBy: { reminderDate: 'asc' },
        }),
        prisma.lead.findMany({
            where: {
                reminderDate: { gt: todayEnd },
                status: { in: ['PENDING', 'NO_ANSWER'] },
            },
            select: {
                id: true,
                csvData: true,
                reminderDate: true,
                reminderNote: true,
                product: { select: { name: true } },
                assignedTo: { select: { name: true } },
            },
            orderBy: { reminderDate: 'asc' },
            take: 10,
        }),
    ]);

    const [openLeads, awaitingShipment, awaitingPrint, inTransit, deliveryExceptions] = await Promise.all([
        prisma.lead.count({ where: { status: { in: ['PENDING', 'NO_ANSWER'] } } }),
        prisma.order.count({ where: { status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] } } }),
        prisma.order.count({ where: { status: { in: ['CONFIRMED', 'SHIPPED'] }, invoicePrinted: false } }),
        prisma.order.count({ where: { status: 'SHIPPED' } }),
        prisma.trackingUpdate.count({ where: { isException: true } }),
    ]);
    const [nextLead, nextShipment, nextPrint, nextException] = await Promise.all([
        prisma.lead.findFirst({ where: { status: { in: ['PENDING', 'NO_ANSWER'] } }, orderBy: { createdAt: 'asc' }, select: { id: true, number: true, createdAt: true, csvData: true } }),
        prisma.order.findFirst({ where: { status: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] } }, orderBy: { createdAt: 'asc' }, select: { id: true, number: true, customerName: true, createdAt: true } }),
        prisma.order.findFirst({ where: { status: { in: ['CONFIRMED', 'SHIPPED'] }, invoicePrinted: false }, orderBy: { createdAt: 'asc' }, select: { id: true, number: true, customerName: true, createdAt: true } }),
        prisma.order.findFirst({ where: { status: 'SHIPPED', trackingUpdates: { some: { isException: true } } }, orderBy: { shippedAt: 'asc' }, select: { id: true, number: true, customerName: true, shippedAt: true } }),
    ]);

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
        reminders: {
            overdue: overdueReminders as any[],
            today: todayReminders as any[],
            upcoming: upcomingReminders as any[],
        },
        operations: { openLeads, awaitingShipment, awaitingPrint, inTransit, deliveryExceptions },
        priorityWork: [
            nextException && { id: `exception-${nextException.id}`, title: `Delivery exception · Order #${nextException.number}`, detail: nextException.customerName, href: `/orders/${nextException.id}`, action: 'Review exception', date: nextException.shippedAt || new Date() },
            nextShipment && { id: `ship-${nextShipment.id}`, title: `Ship order #${nextShipment.number}`, detail: nextShipment.customerName, href: `/orders/${nextShipment.id}?flow=fulfillment&stage=ship`, action: 'Arrange shipping', date: nextShipment.createdAt },
            nextPrint && { id: `print-${nextPrint.id}`, title: `Print order #${nextPrint.number}`, detail: nextPrint.customerName, href: `/orders/${nextPrint.id}?flow=fulfillment&stage=print`, action: 'Print invoice', date: nextPrint.createdAt },
            nextLead && { id: `lead-${nextLead.id}`, title: `Call lead #${nextLead.number}`, detail: String((nextLead.csvData as any)?.name || 'Customer'), href: `/leads/${nextLead.id}`, action: 'Open lead', date: nextLead.createdAt },
        ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
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
