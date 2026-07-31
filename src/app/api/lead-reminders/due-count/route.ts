import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role === 'TEAM_MEMBER' && !session.user.permissions?.includes('VIEW_LEADS')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);
    const count = await prisma.leadReminder.count({
      where: {
        status: 'PENDING',
        remindAt: { lte: new Date() },
        lead: {
          status: { in: ['PENDING', 'NO_ANSWER'] },
          ...(session.user.role === 'TEAM_MEMBER' ? { userId: session.user.id } : {}),
        },
      },
    });
    return NextResponse.json({ count });
  } catch (error) {
    console.error('Error fetching due reminder count:', error);
    return NextResponse.json({ error: 'Failed to fetch reminder count' }, { status: 500 });
  }
}
