// src/app/(authenticated)/leads/page.tsx

import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { LeadsClient } from './leads-client';
import { Prisma, User as PrismaUser, Lead as PrismaLead, Product, LeadStatus } from '@prisma/client';
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
  const productFilter = typeof resolvedSearchParams.product === 'string' ? resolvedSearchParams.product : '';
  const searchQuery = resolvedSearchParams.query as string | undefined;
  const rawPage = Number(resolvedSearchParams.page);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage,100000) : 1;
  const pageSize = [10,25,50,100].includes(Number(resolvedSearchParams.pageSize)) ? Number(resolvedSearchParams.pageSize) : 25;

  // 4. BUILD SECURE WHERE CLAUSE
  const where: Prisma.LeadWhereInput = { tenantId: session.user.tenantId, ...(productFilter ? {product:{is:{id:productFilter}}} : {}), ...(staffFilter && session.user.role !== 'TEAM_MEMBER' ? {userId:staffFilter} : {}) };

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

  const [filterProducts, filterStaff] = await Promise.all([
    prisma.product.findMany({where:{tenantId:session.user.tenantId,isActive:true},select:{id:true,name:true,code:true},orderBy:{name:'asc'}}),
    session.user.role === 'TEAM_MEMBER' ? [] : prisma.user.findMany({where:{tenantId:session.user.tenantId,isActive:true},select:{id:true,name:true},orderBy:{name:'asc'}}),
  ]);
  // 6. PASS DATA TO CLIENT COMPONENT
  return (<>
    <form action="/leads" method="get" className="mx-4 mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 sm:mx-6">
      {Object.entries(resolvedSearchParams).filter(([key,value])=>!['staff','product','page'].includes(key)&&typeof value==='string').map(([key,value])=><input key={key} type="hidden" name={key} value={value as string} />)}
      <label className="text-xs text-muted-foreground">Product<select name="product" defaultValue={productFilter} className="mt-1 block rounded-md border-border bg-background text-sm"><option value="">All products</option>{filterProducts.map(product=><option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</select></label>
      {session.user.role !== 'TEAM_MEMBER' && <label className="text-xs text-muted-foreground">Assigned staff<select name="staff" defaultValue={staffFilter} className="mt-1 block rounded-md border-border bg-background text-sm"><option value="">All staff</option>{filterStaff.map(person=><option key={person.id} value={person.id}>{person.name || 'Unnamed staff'}</option>)}</select></label>}
      <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button><a href="/leads" className="px-3 py-2 text-sm text-muted-foreground">Clear all filters</a>
    </form>
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
    /></>
  );
}
