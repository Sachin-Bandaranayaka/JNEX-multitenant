// src/lib/staff.ts
//
// The rules for who may create, change and remove staff accounts, in one place
// so the collection route, the per-user route and the console page cannot
// disagree about them.

import { Prisma, Role, type User } from '@prisma/client';
import { prisma } from './prisma';
import { can, sanitizePermissions, type Permission } from './permissions';

/// Roles a tenant may hold. SUPER_ADMIN is deliberately absent: it is a
/// platform role, and accepting it from a tenant endpoint would let a tenant
/// admin mint an account with access to every other tenant.
export const ASSIGNABLE_ROLES = [Role.ADMIN, Role.TEAM_MEMBER] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export type Actor = {
  id: string;
  role: string;
  permissions?: readonly string[] | null;
};

export type StaffPolicyFailure = { error: string; status: number };

/// Only a tenant ADMIN may create or touch another ADMIN. A team member who
/// has been delegated MANAGE_USERS looks after team members only -- otherwise
/// the delegation would be a route to promoting yourself.
function isTenantAdmin(actor: Actor) {
  return actor.role === Role.ADMIN || actor.role === Role.SUPER_ADMIN;
}

/// A delegate can only hand out access they hold themselves, so MANAGE_USERS
/// cannot be used to accumulate permissions its holder was never given.
export function permissionsGrantableBy(actor: Actor, requested: readonly string[]): {
  permissions: Permission[];
  rejected: Permission[];
} {
  const permissions = sanitizePermissions(requested);
  if (isTenantAdmin(actor)) {
    return { permissions, rejected: [] };
  }
  const allowed = permissions.filter(permission => can(actor, permission));
  const rejected = permissions.filter(permission => !can(actor, permission));
  return { permissions: allowed, rejected };
}

/// Guard for creating an account, and for the role half of editing one.
export function checkRoleAssignment(actor: Actor, role: AssignableRole): StaffPolicyFailure | null {
  if (role === Role.ADMIN && !isTenantAdmin(actor)) {
    return { error: 'Only an admin can create or modify another admin.', status: 403 };
  }
  return null;
}

/// Guard for editing or deactivating an existing account.
export function checkTargetIsManageable(
  actor: Actor,
  target: { id: string; role: Role },
): StaffPolicyFailure | null {
  if (target.role === Role.SUPER_ADMIN) {
    return { error: 'Platform accounts cannot be managed from here.', status: 403 };
  }
  if (target.role === Role.ADMIN && !isTenantAdmin(actor)) {
    return { error: 'Only an admin can modify another admin.', status: 403 };
  }
  return null;
}

/// Nobody edits their own role or permissions. Without this an admin can
/// demote themselves to a team member and lock the tenant out of staff
/// management entirely -- there is no self-service way back.
export function checkSelfEdit(
  actor: Actor,
  target: { id: string; role: Role; permissions: string[] },
  next: { role: AssignableRole; permissions: readonly string[] },
): StaffPolicyFailure | null {
  if (actor.id !== target.id) return null;

  if (next.role !== target.role) {
    return { error: 'You cannot change your own role.', status: 400 };
  }
  const before = sanitizePermissions(target.permissions).sort().join(',');
  const after = sanitizePermissions(next.permissions).sort().join(',');
  if (before !== after) {
    return { error: 'You cannot change your own permissions.', status: 400 };
  }
  return null;
}

/// A tenant with no active admin left cannot manage its own staff, settings or
/// billing, and only the platform owner can rescue it. Refuse the change that
/// would cause it.
export async function checkLastAdminRemains(
  tenantId: string,
  target: { id: string; role: Role },
  next: { role: AssignableRole; isActive: boolean },
  db: Pick<Prisma.TransactionClient, 'user'> = prisma,
): Promise<StaffPolicyFailure | null> {
  const stillAdmin = next.role === Role.ADMIN && next.isActive;
  if (target.role !== Role.ADMIN || stillAdmin) return null;

  const otherActiveAdmins = await db.user.count({
    where: {
      tenantId,
      role: Role.ADMIN,
      isActive: true,
      id: { not: target.id },
    },
  });

  if (otherActiveAdmins === 0) {
    return {
      error: 'This is the only active admin for the business. Promote another admin first.',
      status: 400,
    };
  }
  return null;
}

type StaffUpdateResult =
  | { ok: true; user: User }
  | { ok: false; failure: StaffPolicyFailure };

/// Atomically checks the last-admin invariant and applies a staff update.
/// Serializable isolation prevents two admins from concurrently observing
/// each other and both leaving the tenant without an active administrator.
export async function updateStaffWithAdminInvariant(args: {
  tenantId: string;
  userId: string;
  next: { role?: AssignableRole; isActive: boolean };
  data: Prisma.UserUpdateInput;
}): Promise<StaffUpdateResult> {
  let lastConflict: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async tx => {
        const current = await tx.user.findFirst({
          where: { id: args.userId, tenantId: args.tenantId },
          select: { id: true, role: true },
        });
        if (!current) {
          return { ok: false, failure: { error: 'User not found', status: 404 } };
        }

        const failure = await checkLastAdminRemains(
          args.tenantId,
          current,
          {
            role: args.next.role ?? (current.role as AssignableRole),
            isActive: args.next.isActive,
          },
          tx,
        );
        if (failure) return { ok: false, failure };

        const user = await tx.user.update({
          where: { id: args.userId, tenantId: args.tenantId },
          data: args.data,
        });
        return { ok: true, user };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // PostgreSQL may abort one participant in a serializable write-skew.
      // Retry so it sees the winner's committed state and returns the normal
      // last-admin policy error instead of a transient 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        lastConflict = error;
        continue;
      }
      throw error;
    }
  }

  throw lastConflict;
}

/// Staff changes are exactly the kind of thing someone needs to be able to
/// reconstruct later, and the audit log already exists for it.
export async function recordStaffEvent(event: {
  actorId: string;
  tenantId: string;
  action: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { headers } = await import('next/headers');
    const { getRequestIdentity } = await import('./impersonation');
    const identity = getRequestIdentity(await headers());
    await prisma.auditEvent.create({
      data: {
        actorId: event.actorId,
        tenantId: event.tenantId,
        action: event.action,
        entityType: 'User',
        entityId: event.targetId,
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
        ...identity,
      },
    });
  } catch (error) {
    // An audit write must never be the reason a staff change fails.
    console.error('Failed to record staff audit event:', error);
  }
}
