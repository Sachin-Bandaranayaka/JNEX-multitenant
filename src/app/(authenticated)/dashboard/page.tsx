import { LeadStatus, OrderStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function getDashboardData(tenantId: string) {
  const prisma = getScopedPrismaClient(tenantId);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfWeek = new Date(startOfToday);
  const dayOfWeek = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
  const startOfSecondHalf = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 16);
  const endOfFirstHalf = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 16);
  const graphEnd = new Date(startOfTomorrow.getTime() - 1);
  const start = new Date(graphEnd);
  start.setDate(start.getDate() - 89);
  start.setHours(0, 0, 0, 0);

  const orderSummaryStart = startOfWeek < startOfMonth ? startOfWeek : startOfMonth;
  const [deliveredOrders, leads, summaryOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: "DELIVERED",
        OR: [
          { deliveredAt: { gte: start, lte: graphEnd } },
          { deliveredAt: null, updatedAt: { gte: start, lte: graphEnd } },
        ],
      },
      select: { total: true, deliveredAt: true, updatedAt: true },
    }),
    prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.findMany({
      where: { createdAt: { gte: orderSummaryStart, lt: startOfTomorrow } },
      select: { createdAt: true, status: true, total: true },
    }),
  ]);

  type SummaryBucket = { count: number; total: number };
  type OrderSummary = {
    total: SummaryBucket;
    pending: SummaryBucket;
    shipped: SummaryBucket;
    returned: SummaryBucket;
    delivered: SummaryBucket;
  };
  const emptySummary = (): OrderSummary => ({
    total: { count: 0, total: 0 },
    pending: { count: 0, total: 0 },
    shipped: { count: 0, total: 0 },
    returned: { count: 0, total: 0 },
    delivered: { count: 0, total: 0 },
  });
  const summarizeOrders = (rangeStart: Date, rangeEnd: Date): OrderSummary => {
    const summary = emptySummary();
    const pendingStatuses = new Set<OrderStatus>([
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.RESCHEDULED,
    ]);

    for (const order of summaryOrders) {
      if (order.createdAt < rangeStart || order.createdAt >= rangeEnd) continue;
      summary.total.count += 1;
      summary.total.total += order.total;

      let bucket: SummaryBucket | undefined;
      if (pendingStatuses.has(order.status)) bucket = summary.pending;
      else if (order.status === OrderStatus.SHIPPED) bucket = summary.shipped;
      else if (order.status === OrderStatus.RETURNED) bucket = summary.returned;
      else if (order.status === OrderStatus.DELIVERED) bucket = summary.delivered;

      if (bucket) {
        bucket.count += 1;
        bucket.total += order.total;
      }
    }
    return summary;
  };

  const firstHalfEnd = startOfTomorrow < endOfFirstHalf ? startOfTomorrow : endOfFirstHalf;
  const orderSummaries = {
    today: summarizeOrders(startOfToday, startOfTomorrow),
    week: summarizeOrders(startOfWeek, startOfTomorrow),
    month: summarizeOrders(startOfMonth, startOfTomorrow),
    firstHalf: summarizeOrders(startOfMonth, firstHalfEnd),
    secondHalf: startOfToday.getDate() >= 16
      ? summarizeOrders(startOfSecondHalf, startOfTomorrow)
      : emptySummary(),
  };

  const daily = new Map<string, { revenue: number; orders: number }>();
  for (let offset = 0; offset < 90; offset++) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    daily.set(dateKey(date), { revenue: 0, orders: 0 });
  }
  for (const order of deliveredOrders) {
    const key = dateKey(order.deliveredAt ?? order.updatedAt);
    const bucket = daily.get(key);
    if (bucket) {
      bucket.revenue += order.total;
      bucket.orders += 1;
    }
  }

  const leadsByStatus = leads.map((lead) => ({
    status: lead.status,
    count: lead._count._all,
  }));
  const totalLeads = leadsByStatus.reduce((sum, item) => sum + item.count, 0);
  const convertedLeads = leadsByStatus.find((item) => item.status === LeadStatus.CONFIRMED)?.count ?? 0;

  return {
    sales: Array.from(daily, ([date, values]) => ({ date, ...values })),
    leadsByStatus,
    allTime: {
      totalLeads,
      convertedLeads,
      conversionRate: totalLeads ? (convertedLeads / totalLeads) * 100 : 0,
    },
    orderSummaries,
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.tenantId) redirect("/auth/signin");
  if (session.user.role !== "ADMIN" && !session.user.permissions?.includes("VIEW_DASHBOARD")) redirect("/unauthorized");

  const dashboardData = await getDashboardData(session.user.tenantId);
  return <DashboardClient initialData={dashboardData} userName={session.user.name} />;
}
