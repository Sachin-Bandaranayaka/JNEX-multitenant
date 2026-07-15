// src/app/(authenticated)/leads/page.tsx

import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { LeadsClient } from './leads-client';
import { Prisma, User as PrismaUser, Lead as PrismaLead, Product } from '@prisma/client';
import { User } from 'next-auth';

// Define a more specific type for our lead data
export type LeadWithDetails = PrismaLead & {
  product: Product;
  assignedTo: PrismaUser | null;
  order: {
    id: string;
    number: number;
    status: string;
    customerName: string;
    customerPhone: string;
    customerSecondPhone: string | null;
    customerAddress: string;
    customerCity: string | null;
    quantity: number;
    discount: number | null;
    shippingProvider: string | null;
    trackingNumber: string | null;
  } | null;
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
  const statusFilter = resolvedSearchParams.status as string | undefined;
  const searchQuery = resolvedSearchParams.query as string | undefined;
  const page = parseInt(resolvedSearchParams.page as string || '1', 10);
  const pageSize = parseInt(resolvedSearchParams.pageSize as string || '25', 10);

  // 4. BUILD SECURE WHERE CLAUSE
  const where: Prisma.LeadWhereInput = {};

  // Team member restriction
  if (session.user.role === 'TEAM_MEMBER') {
    where.userId = session.user.id;
  }

  // Date filters are optional. With no range selected, unresolved leads from
  // every import date remain visible.
  const buildDateRange = (): { gte?: Date; lte?: Date } | null => {
    if (startDate || endDate) {
      const range: { gte?: Date; lte?: Date } = {};
      if (startDate) range.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
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
        order: {
          select: {
            id: true,
            number: true,
            status: true,
            customerName: true,
            customerPhone: true,
            customerSecondPhone: true,
            customerAddress: true,
            customerCity: true,
            quantity: true,
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

  // 6. PASS DATA TO CLIENT COMPONENT
  return (
    <LeadsClient
      initialLeads={leads as LeadWithDetails[]}
      user={session.user as User}
      searchParams={resolvedSearchParams}
      totalCount={totalCount}
      currentPage={page}
      pageSize={pageSize}
      tenantConfig={tenant ? {
        fardaExpressClientId: tenant.fardaExpressClientId || undefined,
        fardaExpressApiKey: tenant.fardaExpressApiKey || undefined,
        transExpressApiKey: tenant.transExpressApiKey || undefined,
        transExpressOrderPrefix: tenant.transExpressOrderPrefix || undefined,
        royalExpressApiKey: tenant.royalExpressApiKey || undefined,
        royalExpressOrderPrefix: tenant.royalExpressOrderPrefix || undefined,
      } : undefined}
    />
  );
}
