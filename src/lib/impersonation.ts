import { prisma } from '@/lib/prisma';

export const IMPERSONATION_DURATION_MINUTES = 15;

export type ValidImpersonation = {
  id: string;
  actorId: string;
  actorName: string | null;
  actorEmail: string;
  targetUserId: string;
  targetUserName: string | null;
  targetUserEmail: string;
  targetPermissions: string[];
  tenantId: string;
  tenantName: string;
  reason: string;
  mode: 'READ_ONLY';
  startedAt: Date;
  expiresAt: Date;
};

export async function validateImpersonationSession(
  sessionId: string,
  expectedActorId: string,
): Promise<ValidImpersonation | null> {
  const access = await prisma.impersonationSession.findUnique({
    where: { id: sessionId },
    include: {
      actor: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      targetUser: { select: { id: true, name: true, email: true, role: true, permissions: true, isActive: true, tenantId: true } },
      tenant: { select: { id: true, name: true, isActive: true } },
    },
  });

  if (access && !access.endedAt && access.expiresAt.getTime() <= Date.now()) {
    await prisma.$transaction(async (tx) => {
      const ended = await tx.impersonationSession.updateMany({ where: { id: access.id, endedAt: null }, data: { endedAt: new Date(), endReason: 'Expired automatically' } });
      if (ended.count) await tx.auditEvent.create({ data: { actorId: access.actorId, impersonationSessionId: access.id, tenantId: access.tenantId, action: 'IMPERSONATION_ENDED', entityType: 'Tenant', entityId: access.tenantId, metadata: { endReason: 'Expired automatically' }, ipAddress: access.ipAddress, userAgent: access.userAgent } });
    });
    return null;
  }

  if (
    !access ||
    access.actorId !== expectedActorId ||
    access.actor.role !== 'SUPER_ADMIN' ||
    !access.actor.isActive ||
    access.targetUser.role !== 'ADMIN' ||
    !access.targetUser.isActive ||
    access.targetUser.tenantId !== access.tenantId ||
    !access.tenant.isActive ||
    access.endedAt ||
    access.mode !== 'READ_ONLY'
  ) {
    return null;
  }

  return {
    id: access.id,
    actorId: access.actorId,
    actorName: access.actor.name,
    actorEmail: access.actor.email,
    targetUserId: access.targetUser.id,
    targetUserName: access.targetUser.name,
    targetUserEmail: access.targetUser.email,
    targetPermissions: access.targetUser.permissions,
    tenantId: access.tenant.id,
    tenantName: access.tenant.name,
    reason: access.reason,
    mode: 'READ_ONLY',
    startedAt: access.startedAt,
    expiresAt: access.expiresAt,
  };
}

export function getRequestIdentity(headers: Headers) {
  const forwarded = headers.get('x-forwarded-for');
  return {
    ipAddress: forwarded?.split(',')[0]?.trim() || headers.get('x-real-ip') || null,
    userAgent: headers.get('user-agent') || null,
  };
}
