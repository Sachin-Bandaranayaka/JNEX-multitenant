// src/lib/authz.ts
//
// Server-side permission guards for route handlers.
//
// Middleware only knows the coarse "can you see this area" permissions, and it
// matches on path prefixes -- so `/api/products` POST and `/api/products` GET
// looked identical to it, and a read-only team member could create records by
// calling the endpoint the UI had hidden from them. Handlers are where the
// specific permission has to be enforced, and this is the shared way to do it.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { can, type Permission } from './permissions';
import type { Session } from 'next-auth';
import { getFreshUserAccess } from './user-access';

export type AuthorizedSession = Session & {
  user: Session['user'] & { tenantId: string };
};

type Guard =
  | { ok: true; session: AuthorizedSession; tenantId: string }
  | { ok: false; response: NextResponse };

/// Requires a signed-in tenant user holding `permission`.
///
/// Returns either the session (already narrowed so `tenantId` is a string) or
/// the response to hand straight back to the client.
export async function requirePermission(permission: Permission): Promise<Guard> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const actorId = session.user.actor?.id || session.user.id;
  const access = await getFreshUserAccess(actorId);
  if (
    !access?.isActive ||
    (access.role !== 'SUPER_ADMIN' && !access.tenantIsActive)
  ) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!can(session.user, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'You do not have permission to perform this action.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    session: session as AuthorizedSession,
    tenantId: session.user.tenantId,
  };
}

/// Requires any one of several permissions -- for endpoints a couple of
/// different roles legitimately reach (printing an invoice, for instance).
export async function requireAnyPermission(permissions: readonly Permission[]): Promise<Guard> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const actorId = session.user.actor?.id || session.user.id;
  const access = await getFreshUserAccess(actorId);
  if (
    !access?.isActive ||
    (access.role !== 'SUPER_ADMIN' && !access.tenantIsActive)
  ) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (!permissions.some(permission => can(session.user, permission))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'You do not have permission to perform this action.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    session: session as AuthorizedSession,
    tenantId: session.user.tenantId,
  };
}

/// Requires a tenant ADMIN specifically -- not a delegate holding some
/// permission. Used for the handful of actions that are the business owner's
/// alone, such as deciding which staff member a lead belongs to.
export async function requireTenantAdmin(): Promise<Guard> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.tenantId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const actorId = session.user.actor?.id || session.user.id;
  const access = await getFreshUserAccess(actorId);
  if (
    !access?.isActive ||
    (access.role !== 'SUPER_ADMIN' && !access.tenantIsActive)
  ) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  if (session.user.role !== 'ADMIN') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Only an admin can perform this action.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    session: session as AuthorizedSession,
    tenantId: session.user.tenantId,
  };
}
