import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient, prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createReminderSchema = z.object({
  remindAt: z.string().datetime(),
  note: z.string().trim().max(1000).nullable().optional(),
});

function canEditLeads(role: string | undefined, permissions: string[] | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || permissions?.includes('EDIT_LEADS');
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canEditLeads(session.user.role, session.user.permissions)) {
      return NextResponse.json({ error: 'You do not have permission to schedule reminders' }, { status: 403 });
    }

    const { leadId } = await params;
    const data = createReminderSchema.parse(await request.json());
    const remindAt = new Date(data.remindAt);
    if (remindAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Reminder time must be in the future' }, { status: 400 });
    }

    const scopedPrisma = getScopedPrismaClient(session.user.tenantId);
    const lead = await scopedPrisma.lead.findFirst({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }
    if (!['PENDING', 'NO_ANSWER'].includes(lead.status)) {
      return NextResponse.json({ error: 'Reminders can only be scheduled for open leads' }, { status: 400 });
    }
    if (session.user.role === 'TEAM_MEMBER' && lead.userId !== session.user.id) {
      return NextResponse.json({ error: 'You do not have access to this lead' }, { status: 403 });
    }

    const note = data.note || null;
    const reminder = await prisma.$transaction(async (tx) => {
      await tx.leadReminder.updateMany({
        where: {
          tenantId: session.user.tenantId,
          leadId,
          status: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          completedById: session.user.id,
        },
      });

      const created = await tx.leadReminder.create({
        data: {
          tenantId: session.user.tenantId,
          leadId,
          assignedUserId: lead.userId,
          createdById: session.user.id,
          remindAt,
          note,
        },
        include: {
          lead: {
            include: {
              product: true,
              assignedTo: true,
            },
          },
        },
      });

      await tx.lead.update({
        where: { id: leadId },
        data: { reminderDate: remindAt, reminderNote: note },
      });
      return created;
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid reminder details', details: error.errors }, { status: 400 });
    }
    console.error('Error scheduling lead reminder:', error);
    return NextResponse.json({ error: 'Failed to schedule reminder' }, { status: 500 });
  }
}
