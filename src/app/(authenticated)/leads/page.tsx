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
  const userFilter = resolvedSearchParams.userId as string | undefined;
  const searchQuery = resolvedSearchParams.query as string | undefined;
  const page = parseInt(resolvedSearchParams.page as string || '1', 10);
  const pageSize = parseInt(resolvedSearchParams.pageSize as string || '25', 10);

  // 4. BUILD SECURE WHERE CLAUSE
  const where: Prisma.LeadWhereInput = {};

  // Team member restriction
  if (session.user.role === 'TEAM_MEMBER') {
    where.userId = session.user.id;
  }

  // Date range filter
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  // Status filter
  if (statusFilter && statusFilter !== 'ANY') {
    where.status = statusFilter as any;
  }

  // User/staff filter
  if (userFilter && userFilter !== 'ANY') {
    where.userId = userFilter;
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

  const [leads, totalCount, tenant, teamMembers] = await Promise.all([
    prisma.lead.findMany({
      where,
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
            trackingNumber: true
          }
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }),
    // Get total count for pagination
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
    // Fetch team members for the user filter dropdown
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // 6. PASS DATA TO CLIENT COMPONENT
  return (
    <LeadsClient
      initialLeads={leads as LeadWithDetails[]}
      user={session.user as User}
      searchParams={resolvedSearchParams}
      totalCount={totalCount}
      currentPage={page}
      pageSize={pageSize}
      teamMembers={teamMembers}
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