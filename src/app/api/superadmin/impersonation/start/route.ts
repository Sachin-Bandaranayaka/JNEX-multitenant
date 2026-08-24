import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { compare } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin, AuthorizationError } from '@/lib/superadmin-auth';
import { getRequestIdentity, IMPERSONATION_DURATION_MINUTES } from '@/lib/impersonation';

const StartAccessSchema = z.object({
  tenantId: z.string().min(1),
  targetUserId: z.string().min(1),
  password: z.string().min(1, 'Enter your current password.'),
  reason: z.string().trim().min(10, 'Give a clear reason of at least 10 characters.').max(500),
});

export async function POST(request: Request) {
  try {
    const { actor } = await requireSuperAdmin();
    const parsed = StartAccessSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the access details.' }, { status: 400 });
    }
    const { tenantId, targetUserId, password, reason } = parsed.data;
    if (!(await compare(password, actor.password))) {
      return NextResponse.json({ error: 'Your current Super Admin password is incorrect.' }, { status: 401 });
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, tenantId, role: 'ADMIN', isActive: true, tenant: { isActive: true } },
      select: { id: true, tenant: { select: { id: true, name: true } } },
    });
    if (!target) {
      return NextResponse.json({ error: 'Choose an active ADMIN account for an active tenant.' }, { status: 400 });
    }

    const requestHeaders = await headers();
    const identity = getRequestIdentity(requestHeaders);
    const expiresAt = new Date(Date.now() + IMPERSONATION_DURATION_MINUTES * 60_000);
    const access = await prisma.$transaction(async (tx) => {
      await tx.impersonationSession.updateMany({
        where: { actorId: actor.id, endedAt: null, expiresAt: { gt: new Date() } },
        data: { endedAt: new Date(), endReason: 'Replaced by a new access session' },
      });
      const created = await tx.impersonationSession.create({
        data: { actorId: actor.id, targetUserId, tenantId, reason, expiresAt, ...identity },
      });
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          impersonationSessionId: created.id,
          tenantId,
          action: 'IMPERSONATION_STARTED',
          entityType: 'Tenant',
          entityId: tenantId,
          metadata: { mode: 'READ_ONLY', reason, targetUserId, expiresAt: expiresAt.toISOString(), tenantName: target.tenant.name },
          ...identity,
        },
      });
      return created;
    });

    // No roles, tenant claims, user data, or passwords are returned.
    return NextResponse.json({ impersonationSessionId: access.id });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    if (status === 500) console.error('Unable to start tenant access:', error);
    return NextResponse.json({ error: status === 500 ? 'Unable to start tenant access.' : (error as Error).message }, { status });
  }
}

