// src/app/api/leads/assign/route.ts
//
// Hands leads to a member of staff.
//
// A lead's owner used to be stamped once, at creation or import, and nothing
// could ever change it -- so every lead the owner imported stayed invisible to
// the staff who were supposed to work it, because the leads list shows a team
// member only their own records.
//
// Deciding who works which lead is the business owner's call, so this is
// admin-only rather than a delegable permission.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { requireTenantAdmin } from '@/lib/authz';
import { recordLeadAssignment } from '@/lib/lead-assignment';

export const dynamic = 'force-dynamic';

const AssignSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, 'Select at least one lead').max(500),
  // The staff member to hand them to. Null means "unassign", which leaves the
  // lead in the pool only an admin can see.
  userId: z.string().uuid().nullable(),
});

export async function POST(request: Request) {
  try {
    const guard = await requireTenantAdmin();
    if (!guard.ok) return guard.response;

    const body = await request.json();
    const { leadIds, userId } = AssignSchema.parse(body);

    const prisma = getScopedPrismaClient(guard.tenantId);

    // The assignee has to be a real, active member of this tenant's staff. The
    // scoped client already confines the lookup to the tenant; the rest stops
    // a lead being parked on a deactivated account where nobody would see it.
    if (userId) {
      const assignee = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isActive: true, role: true, name: true, email: true },
      });
      if (!assignee || !assignee.isActive || assignee.role === Role.SUPER_ADMIN) {
        return NextResponse.json(
          { error: 'That staff member is not available for assignment.' },
          { status: 400 },
        );
      }
    }

    // Only leads that are actually this tenant's, and not deleted ones.
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, status: { not: 'DELETED' } },
      select: { id: true, userId: true },
    });

    if (leads.length === 0) {
      return NextResponse.json({ error: 'No matching leads found.' }, { status: 404 });
    }

    const changing = leads.filter(lead => lead.userId !== userId).map(lead => lead.id);

    if (changing.length > 0) {
      await globalPrisma.$transaction(async (tx) => {
        await tx.lead.updateMany({
          where: { id: { in: changing }, tenantId: guard.tenantId },
          data: { userId },
        });

        // A reminder that is still waiting belongs to whoever now owns the
        // lead; leaving it behind would keep the lead in the previous person's
        // Remind Leads queue and out of the new owner's.
        await tx.leadReminder.updateMany({
          where: {
            leadId: { in: changing },
            tenantId: guard.tenantId,
            status: 'PENDING',
          },
          data: { assignedUserId: userId },
        });
      });
    }

    await recordLeadAssignment({
      actorId: guard.session.user.id,
      tenantId: guard.tenantId,
      leadIds: changing,
      assigneeId: userId,
    });

    return NextResponse.json({
      assigned: changing.length,
      unchanged: leads.length - changing.length,
      notFound: leadIds.length - leads.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 },
      );
    }
    console.error('Lead assignment failed:', error);
    return NextResponse.json({ error: 'Failed to assign leads' }, { status: 500 });
  }
}
