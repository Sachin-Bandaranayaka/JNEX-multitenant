import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { ReturnedListClient } from './returned-list-client';

export default async function ReturnedListPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return redirect('/auth/signin');
  }

  const prisma = getScopedPrismaClient(session.user.tenantId);

  const returnedOrders = await prisma.order.findMany({
    where: {
      status: 'RETURNED',
      ...(session.user.role === 'TEAM_MEMBER' ? { userId: session.user.id } : {}),
    },
    include: {
      product: true,
      assignedTo: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return <ReturnedListClient orders={returnedOrders as any} />;
}
