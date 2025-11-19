import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { User } from 'next-auth';
import { OrdersClient } from './orders-client'; // Import our new client component
import { SearchOrders } from '@/components/orders/search-orders';
import { SortOrders } from '@/components/orders/sort-orders';
import { DateFilter } from '@/components/orders/date-filter';

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

  if (!canViewAll) {
    return redirect('/unauthorized');
  }

  const prisma = getScopedPrismaClient(user.tenantId);

  const [sortField, sortDirection] = sortParam.split(':');
  const orderBy = { [sortField]: sortDirection };

  // Build date filter conditions
  const dateConditions: Prisma.OrderWhereInput = {};
  if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    dateConditions.createdAt = {
      gte: start,
      lte: end,
    };
  }

  const where: Prisma.OrderWhereInput = {
    ...(!canViewAll && user.role === 'TEAM_MEMBER' ? { userId: user.id } : {}),
    ...(searchQuery ? {
      OR: [
        { id: { contains: searchQuery, mode: 'insensitive' } },
        { customerName: { contains: searchQuery, mode: 'insensitive' } },
        { customerPhone: { contains: searchQuery, mode: 'insensitive' } },
        { product: { name: { contains: searchQuery, mode: 'insensitive' } } },
      ],
    } : {}),
    ...dateConditions,
  };

  const orders = await prisma.order.findMany({
    where,
    include: { product: true, lead: true, assignedTo: true },
    orderBy,
  });

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 bg-background">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Orders</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage orders and track their status
              {searchQuery && ` • Searching: "${searchQuery}"`}
              {dateFilter && startDate && endDate && (
                <span className="inline-flex items-center gap-1 ml-2 px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-md text-xs font-medium">
                  📅 {startDate} to {endDate}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filter Controls Section */}
        <div className="bg-card rounded-lg p-4 ring-1 ring-border">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
              <DateFilter />
              <div className="hidden sm:block w-px h-6 bg-border"></div>
              <SearchOrders />
              <div className="hidden sm:block w-px h-6 bg-border"></div>
              <SortOrders />
            </div>
          </div>
        </div>
      </div>

      {/* Render the new client component with the fetched data */}
      <OrdersClient initialOrders={orders} user={user} />
    </div>
  );
}
