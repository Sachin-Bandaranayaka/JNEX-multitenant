import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin, AuthorizationError } from '@/lib/superadmin-auth';
import { getRequestIdentity } from '@/lib/impersonation';

export async function POST() {
  try {
    const { actor, session } = await requireSuperAdmin({ allowDuringImpersonation: true });
    const access = session.user.impersonation;
    if (!access) return NextResponse.json({ ok: true });

    const identity = getRequestIdentity(await headers());
    await prisma.$transaction(async (tx) => {
      const ended = await tx.impersonationSession.updateMany({
        where: { id: access.sessionId, actorId: actor.id, endedAt: null },
        data: { endedAt: new Date(), endReason: 'Exited by Super Admin' },
      });
      if (ended.count) {
        await tx.auditEvent.create({
          data: {
            actorId: actor.id,
            impersonationSessionId: access.sessionId,
            tenantId: access.tenantId,
            action: 'IMPERSONATION_ENDED',
            entityType: 'Tenant',
            entityId: access.tenantId,
            metadata: { endReason: 'Exited by Super Admin' },
            ...identity,
          },
        });
      }
    });
    return NextResponse.json({ ok: true, tenantId: access.tenantId });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? 'Unable to end tenant access.' : (error as Error).message }, { status });
  }
}

