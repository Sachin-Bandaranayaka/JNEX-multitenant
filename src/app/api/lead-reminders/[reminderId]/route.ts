import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient, prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateReminderSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('complete') }),
  z.object({ action: z.literal('cancel') }),
  z.object({
    action: z.literal('reschedule'),
    remindAt: z.string().datetime(),
    note: z.string().trim().max(1000).nullable().optional(),
  }),
]);

function canEditLeads(role: string | undefined, permissions: string[] | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN' || permissions?.includes('EDIT_LEADS');
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reminderId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canEditLeads(session.user.role, session.user.permissions)) {
      return NextResponse.json({ error: 'You do not have permission to update reminders' }, { status: 403 });
    }

    const { reminderId } = await params;
    const data = updateReminderSchema.parse(await request.json());
    const scopedPrisma = getScopedPrismaClient(session.user.tenantId);
    const reminder = await scopedPrisma.leadReminder.findFirst({
      where: { id: reminderId },
      include: { lead: true },
    });

    if (!reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }
    if (session.user.role === 'TEAM_MEMBER' && reminder.lead.userId !== session.user.id) {
      return NextResponse.json({ error: 'You do not have access to this reminder' }, { status: 403 });
    }
    if (reminder.status !== 'PENDING') {
      return NextResponse.json({ error: 'This reminder is no longer active' }, { status: 409 });
    }

    if (data.action === 'reschedule') {
      const remindAt = new Date(data.remindAt);
      if (remindAt.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Reminder time must be in the future' }, { status: 400 });
      }
      const note = data.note === undefined ? reminder.note : data.note || null;

      const replacement = await prisma.$transaction(async (tx) => {
        await tx.leadReminder.update({
          where: { id: reminder.id },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
            completedById: session.user.id,
          },
        });
        const created = await tx.leadReminder.create({
          data: {
            tenantId: session.user.tenantId,
            leadId: reminder.leadId,
            assignedUserId: reminder.assignedUserId,
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
          where: { id: reminder.leadId },
          data: { reminderDate: remindAt, reminderNote: note },
        });
        return created;
      });
      return NextResponse.json(replacement);
    }

    const nextStatus = data.action === 'complete' ? 'COMPLETED' : 'CANCELLED';
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.leadReminder.update({
        where: { id: reminder.id },
        data: {
          status: nextStatus,
          completedAt: new Date(),
          completedById: session.user.id,
        },
      });
      await tx.lead.update({
        where: { id: reminder.leadId },
        data: { reminderDate: null, reminderNote: null },
      });
      return result;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid reminder action', details: error.errors }, { status: 400 });
    }
    console.error('Error updating lead reminder:', error);
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 });
  }
}
