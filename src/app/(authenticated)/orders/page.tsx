import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { User } from 'next-auth';
import { OrdersClient } from './orders-client'; // Import our new client component
import { SearchOrders } from '@/components/orders/search-orders';
import { SortOrders } from '@/components/orders/sort-orders';
import { DateFilter } from '@/components/orders/date-filter';
import { orderSearchConditions } from '@/lib/order-search';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  const resolvedSearchParams = await searchParams;
  const searchQuery = (resolvedSearchParams.query as string) || '';
  const sortParam = (resolvedSearchParams.sort as string) || 'createdAt:asc'; // Default to oldest first
  const dateFilter = (resolvedSearchParams.dateFilter as string) || '';
  const startDate = (resolvedSearchParams.startDate as string) || '';
  const endDate = (resolvedSearchParams.endDate as string) || '';

  if (!session?.user?.tenantId) {
    return redirect('/auth/signin');
  }

  const user = session.user as User;
  const canViewAll = user.role === 'ADMIN' || user.permissions?.includes('VIEW_ORDERS');
  // Team members without VIEW_ORDERS may still open the page — they just see
  // their own orders (enforced by the userId filter in `where` below).
  const canViewOwn = user.role === 'TEAM_MEMBER';

  if (!canViewAll && !canViewOwn) {
    return redirect('/unauthorized');
  }

  const prisma = getScopedPrismaClient(user.tenantId);

  const [rawField, rawDirection] = sortParam.split(':');
  const sortField = ['createdAt','number','total','customerName','status'].includes(rawField) ? rawField : 'createdAt';
  const sortDirection: 'asc'|'desc' = rawDirection === 'desc' ? 'desc' : 'asc';
  const orderBy = { [sortField]: sortDirection };
  const filterValue = (key:string) => typeof resolvedSearchParams[key] === 'string' ? resolvedSearchParams[key] as string : '';
  const staff = filterValue('staff'), product = filterValue('product'), status = filterValue('status');
  const minAmount = filterValue('minAmount'), maxAmount = filterValue('maxAmount');

  // Build date filter conditions
  const dateConditions: Prisma.OrderWhereInput = {};
  if (startDate && endDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && Number.isFinite(new Date(startDate).getTime()) && Number.isFinite(new Date(endDate).getTime())) {
    const start = new Date(`${startDate}T00:00:00+05:30`);
    const end = new Date(new Date(`${endDate}T00:00:00+05:30`).getTime()+86400000-1);

    dateConditions.createdAt = {
      gte: start,
      lte: end,
    };
  }

  const where: Prisma.OrderWhereInput = {
    ...(!canViewAll && user.role === 'TEAM_MEMBER' ? { userId: user.id } : {}),
    // This page is the pre-shipping queue. Other lifecycle states remain
    // available through search, order details, shipping, and return pages.
    status: ['PENDING','CONFIRMED'].includes(status) ? status as 'PENDING'|'CONFIRMED' : {in:['PENDING','CONFIRMED']},
    shippedAt:null, trackingNumber:null,
    ...(product ? {productId:product} : {}),
    ...(staff && canViewAll ? {userId:staff} : {}),
    total: { ...(minAmount !== '' && Number.isFinite(Number(minAmount)) ? {gte:Number(minAmount)} : {}), ...(maxAmount !== '' && Number.isFinite(Number(maxAmount)) ? {lte:Number(maxAmount)} : {}) },
    ...(searchQuery ? {
      OR: [
        ...orderSearchConditions(searchQuery),
        { product: { name: { contains: searchQuery, mode: 'insensitive' } } },
      ],
    } : {}),
    ...dateConditions,
  };

  const [orders, tenant, filterProducts, filterStaff] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { product: true, lead: true, assignedTo: true },
      orderBy,
    }),
    globalPrisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { transExpressApiKey: true, transExpressOrderPrefix: true },
    }),
    prisma.product.findMany({where:{tenantId:user.tenantId,isActive:true},select:{id:true,name:true,code:true},orderBy:{name:'asc'}}),
    canViewAll ? prisma.user.findMany({where:{tenantId:user.tenantId,isActive:true},select:{id:true,name:true},orderBy:{name:'asc'}}) : [],
  ]);

  const tenantConfig = {
    hasTransExpress: !!tenant?.transExpressApiKey,
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 bg-background">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pending Orders</h1>
            <p className="text-sm text-muted-foreground">
              Review pending and confirmed orders before booking and dispatch
              {searchQuery && ` • Searching: "${searchQuery}"`}
              {dateFilter && startDate && endDate && (
                <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                  📅 {startDate} to {endDate}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filter Controls Section */}
        <div className="bg-card rounded-2xl p-2 border border-border shadow-sm">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-2">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <DateFilter />
              <div className="hidden sm:block w-px h-6 bg-border"></div>
              <SortOrders />
            </div>
            <div className="w-full lg:w-auto">
              <SearchOrders />
            </div>
          </div>
        </div>
      </div>

      <form action="/orders" method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        {Object.entries(resolvedSearchParams).filter(([key,value])=>!['staff','product','status','minAmount','maxAmount','page'].includes(key)&&typeof value==='string').map(([key,value])=><input key={key} type="hidden" name={key} value={value as string} />)}
        <label className="text-xs text-muted-foreground">Product<select name="product" defaultValue={product} className="mt-1 block rounded-md border-border bg-background text-sm"><option value="">All products</option>{filterProducts.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
        {canViewAll && <label className="text-xs text-muted-foreground">Staff<select name="staff" defaultValue={staff} className="mt-1 block rounded-md border-border bg-background text-sm"><option value="">All staff</option>{filterStaff.map(item=><option key={item.id} value={item.id}>{item.name || 'Unnamed staff'}</option>)}</select></label>}
        <label className="text-xs text-muted-foreground">Status<select name="status" defaultValue={status} className="mt-1 block rounded-md border-border bg-background text-sm"><option value="">Pending and confirmed</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option></select></label>
        <label className="text-xs text-muted-foreground">Minimum total<input type="number" name="minAmount" min="0" step="0.01" defaultValue={minAmount} className="mt-1 block w-32 rounded-md border-border bg-background text-sm" /></label><label className="text-xs text-muted-foreground">Maximum total<input type="number" name="maxAmount" min="0" step="0.01" defaultValue={maxAmount} className="mt-1 block w-32 rounded-md border-border bg-background text-sm" /></label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Apply</button><a href="/orders" className="px-3 py-2 text-sm text-muted-foreground">Clear filters</a>
      </form>
      {/* Render the new client component with the fetched data */}
      <OrdersClient initialOrders={orders} user={user} tenantConfig={tenantConfig} />
    </div>
  );
}
