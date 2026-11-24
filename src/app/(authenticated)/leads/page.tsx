// src/app/(authenticated)/leads/page.tsx

import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { LeadsClient } from './leads-client';
import { Prisma, User as PrismaUser, Lead as PrismaLead, Product, LeadStatus } from '@prisma/client';
import { User } from 'next-auth';
import { Open_Sans } from 'next/font/google';

// The lead list uses Open Sans (400/500/600/700) per docs/LEAD_PAGE_DESIGN_SPEC.md.
const openSans = Open_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

// Define a more specific type for our lead data
export type LeadWithDetails = PrismaLead & {
  product: Product;
  assignedTo: PrismaUser | null;
  order: {
    id: string;
    number: number;
    orderCode: string | null;
    status: string;
    customerName: string;
    customerPhone: string;
    customerSecondPhone: string | null;
    customerAddress: string;
    customerCity: string | null;
    quantity: number;
    total: number;
    codAmount: number | null;
    discount: number | null;
    shippingProvider: string | null;
    trackingNumber: string | null;
  } | null;
  reminders?: Array<{
    id: string;
    remindAt: Date;
    note: string | null;
    status: string;
  }>;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  // 1. SECURE THE PAGE
  if (!session?.user?.tenantId) {
    return redirect('/auth/signin');
  }

  // Redirect if a team member without VIEW_LEADS tries to access
  if (session.user.role === 'TEAM_MEMBER' && !session.user.permissions?.includes('VIEW_LEADS')) {
    return redirect('/unauthorized');
  }

  // 2. USE SCOPED PRISMA CLIENT
  const prisma = getScopedPrismaClient(session.user.tenantId);

  const resolvedSearchParams = await searchParams;

  // 3. EXTRACT FILTER PARAMS
  const startDate = resolvedSearchParams.startDate as string | undefined;
  const endDate = resolvedSearchParams.endDate as string | undefined;
  const rawStatus = resolvedSearchParams.status;
  const statusFilter = typeof rawStatus === 'string' && Object.values(LeadStatus).includes(rawStatus as LeadStatus) ? rawStatus : undefined;
  const staffFilter = typeof resolvedSearchParams.staff === 'string' ? resolvedSearchParams.staff : '';
  const searchQuery = resolvedSearchParams.query as string | undefined;
  const rawPage = Number(resolvedSearchParams.page);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage,100000) : 1;
  const pageSize = [10,25,50,100].includes(Number(resolvedSearchParams.pageSize)) ? Number(resolvedSearchParams.pageSize) : 25;

  // 4. BUILD SECURE WHERE CLAUSE
  const where: Prisma.LeadWhereInput = { tenantId: session.user.tenantId, ...(staffFilter && session.user.role !== 'TEAM_MEMBER' ? {userId:staffFilter} : {}) };

  // Team member restriction
  if (session.user.role === 'TEAM_MEMBER') {
    where.userId = session.user.id;
  }

  // Date filters are optional. With no range selected, unresolved leads from
  // every import date remain visible.
  const buildDateRange = (): { gte?: Date; lte?: Date } | null => {
    if (startDate || endDate) {
      const range: { gte?: Date; lte?: Date } = {};
      if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && Number.isFinite(new Date(startDate).getTime())) range.gte = new Date(`${startDate}T00:00:00+05:30`);
      if (typeof endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && Number.isFinite(new Date(endDate).getTime())) {
        const end = new Date(new Date(`${endDate}T00:00:00+05:30`).getTime()+86400000-1);
        range.lte = end;
      }
      return range;
    }
    return null;
  };

  const dateRange = buildDateRange();
  if (dateRange) {
    where.createdAt = dateRange;
  }

  // Status filter
  if (statusFilter && statusFilter !== 'ANY') {
    where.status = statusFilter as any;
  }

  // Search query (search in JSON data)
  if (searchQuery) {
    where.OR = [
      { csvData: { path: ['name'], string_contains: searchQuery } },
      { csvData: { path: ['phone'], string_contains: searchQuery } },
      { csvData: { path: ['address'], string_contains: searchQuery } },
    ];
  }

  // 5. FETCH SECURE DATA WITH PAGINATION
  const skip = (page - 1) * pageSize;

  const [statusGroups, totalCount, tenant] = await Promise.all([
    prisma.lead.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.lead.count({ where }),
    // Get tenant configuration for shipping providers
    globalPrisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        fardaExpressClientId: true,
        fardaExpressApiKey: true,
        transExpressApiKey: true,
        transExpressOrderPrefix: true,
        royalExpressApiKey: true,
        royalExpressOrderPrefix: true,
      }
    }),
  ]);

  const priority = statusFilter && statusFilter !== 'ANY'
    ? [statusFilter]
    : ['PENDING', 'NO_ANSWER', 'CONFIRMED', 'REJECTED', 'DELETED'];
  const countByStatus = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const leads: PrismaLead[] = [];
  let offset = skip;
  let remaining = pageSize;

  for (const status of priority) {
    if (remaining <= 0) break;
    const statusCount = countByStatus.get(status as any) || 0;
    if (offset >= statusCount) {
      offset -= statusCount;
      continue;
    }

    const batch = await prisma.lead.findMany({
      where: { ...where, status: status as any },
      include: {
        product: true,
        assignedTo: true,
        reminders: {
          where: { status: 'PENDING' },
          orderBy: { remindAt: 'asc' },
          take: 1,
          select: {
            id: true,
            remindAt: true,
            note: true,
            status: true,
          },
        },
        order: {
          select: {
            id: true,
            number: true,
            orderCode: true,
            status: true,
            customerName: true,
            customerPhone: true,
            customerSecondPhone: true,
            customerAddress: true,
            customerCity: true,
            quantity: true,
          total: true,
          codAmount: true,
            discount: true,
            shippingProvider: true,
            trackingNumber: true,
          },
        },
      },
      // Forgotten unresolved leads come first. Completed/closed groups retain
      // the familiar newest-first ordering.
      orderBy: { createdAt: status === 'PENDING' || status === 'NO_ANSWER' ? 'asc' : 'desc' },
      skip: offset,
      take: remaining,
    });
    leads.push(...(batch as any));
    remaining -= batch.length;
    offset = 0;
  }

  const filterStaff = session.user.role === 'TEAM_MEMBER' ? [] : await prisma.user.findMany({where:{tenantId:session.user.tenantId,isActive:true},select:{id:true,name:true},orderBy:{name:'asc'}});
  // 6. PASS DATA TO CLIENT COMPONENT
  return (
    <div className={`${openSans.className} ll-page`}>
    <LeadsClient
      initialLeads={leads as LeadWithDetails[]}
      user={session.user as User}
      searchParams={resolvedSearchParams}
      totalCount={totalCount}
      currentPage={page}
      pageSize={pageSize}
      filterStaff={filterStaff}
      tenantConfig={tenant ? {
        fardaExpressClientId: tenant.fardaExpressClientId || undefined,
        fardaExpressApiKey: tenant.fardaExpressApiKey || undefined,
        transExpressApiKey: tenant.transExpressApiKey || undefined,
        transExpressOrderPrefix: tenant.transExpressOrderPrefix || undefined,
        royalExpressApiKey: tenant.royalExpressApiKey || undefined,
        royalExpressOrderPrefix: tenant.royalExpressOrderPrefix || undefined,
      } : undefined}
    />
    </div>
  );
}
