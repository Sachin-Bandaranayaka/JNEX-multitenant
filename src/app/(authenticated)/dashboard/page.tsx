import { LeadStatus } from "@prisma/client";
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
  const graphEnd = new Date(startOfTomorrow.getTime() - 1);
  const start = new Date(graphEnd);
  start.setDate(start.getDate() - 89);
  start.setHours(0, 0, 0, 0);

  const [deliveredOrders, leads, pendingLeads, newLeadsToday, shippedToday, deliveredToday] = await Promise.all([
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
    prisma.lead.count({ where: { status: LeadStatus.PENDING } }),
    prisma.lead.count({ where: { createdAt: { gte: startOfToday, lt: startOfTomorrow } } }),
    prisma.order.count({ where: { shippedAt: { gte: startOfToday, lt: startOfTomorrow } } }),
    prisma.order.aggregate({
      where: { deliveredAt: { gte: startOfToday, lt: startOfTomorrow } },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);

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
    dailyReview: {
      pendingLeads,
      newLeadsToday,
      shippedToday,
      deliveredToday: deliveredToday._count._all,
      revenueToday: deliveredToday._sum.total ?? 0,
      date: dateKey(startOfToday),
    },
  };
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.tenantId) redirect("/auth/signin");
  if (session.user.role !== "ADMIN" && !session.user.permissions?.includes("VIEW_DASHBOARD")) redirect("/unauthorized");

  const dashboardData = await getDashboardData(session.user.tenantId);
  return <DashboardClient initialData={dashboardData} userName={session.user.name} />;
}
