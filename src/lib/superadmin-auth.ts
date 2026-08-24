import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export class AuthorizationError extends Error {
  status = 403;
}

export async function requireSuperAdmin(options: { allowDuringImpersonation?: boolean } = {}) {
  const session = await getServerSession(authOptions);
  const actorId = session?.user?.actor?.id || session?.user?.id;

  if (!actorId || session?.user?.originalRole !== 'SUPER_ADMIN') {
    throw new AuthorizationError('Super Admin access required.');
  }
  if (session.user.impersonation && !options.allowDuringImpersonation) {
    throw new AuthorizationError('Exit read-only tenant access before performing this action.');
  }

  const actor = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, email: true, name: true, role: true, isActive: true, password: true, tenantId: true },
  });
  if (!actor || actor.role !== 'SUPER_ADMIN' || !actor.isActive) {
    throw new AuthorizationError('Your Super Admin account is not active.');
  }
  return { session, actor };
}
