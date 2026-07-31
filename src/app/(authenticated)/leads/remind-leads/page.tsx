import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { RemindLeadsClient } from './remind-leads-client';

export default async function RemindLeadsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return redirect('/auth/signin');
  }

  if (session.user.role === 'TEAM_MEMBER' && !session.user.permissions?.includes('VIEW_LEADS')) {
    return redirect('/unauthorized');
  }

  const prisma = getScopedPrismaClient(session.user.tenantId);

  const reminders = await prisma.leadReminder.findMany({
    where: {
      status: 'PENDING',
      lead: {
        status: { in: ['PENDING', 'NO_ANSWER'] },
        ...(session.user.role === 'TEAM_MEMBER' ? { userId: session.user.id } : {}),
      },
    },
    include: {
      lead: {
        include: {
          product: true,
          assignedTo: true,
        },
      },
    },
    orderBy: { remindAt: 'asc' },
  });

  return <RemindLeadsClient reminders={reminders} />;
}
