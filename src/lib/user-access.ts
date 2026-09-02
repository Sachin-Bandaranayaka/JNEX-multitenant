// src/lib/user-access.ts
//
// Role and permissions were copied into the JWT at sign-in and never looked at
// again, so editing a staff member's access changed nothing until they signed
// out -- grants appeared to do nothing and, worse, revocations did nothing.
// This module is the authoritative read of what a user may do *right now*.
//
// The read is cached for a few seconds per process: the JWT callback runs on
// every `getServerSession`, and one database round trip per request just to
// re-read two columns would be wasteful. The window is short enough that an
// admin's change is felt while they are still looking at the screen.

import { prisma } from './prisma';
import { sanitizePermissions, type Permission } from './permissions';
import type { Role } from '@prisma/client';

export type UserAccess = {
  role: Role;
  permissions: Permission[];
  isActive: boolean;
  tenantId: string;
  tenantIsActive: boolean;
  passwordChangedAt: Date | null;
};

const ACCESS_CACHE_TTL_MS = 15 * 1000;

type CacheEntry = { value: UserAccess | null; expiresAt: number };

// Module scope survives between requests on a warm server instance and is
// discarded on a cold start, which is exactly the lifetime we want.
const cache = new Map<string, CacheEntry>();

/// Called whenever a user's access changes, so the person editing sees the
/// effect immediately rather than after the TTL.
export function invalidateUserAccess(userId: string) {
  cache.delete(userId);
}

export function invalidateAllUserAccess() {
  cache.clear();
}

export async function getFreshUserAccess(userId: string): Promise<UserAccess | null> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      permissions: true,
      isActive: true,
      passwordChangedAt: true,
      tenantId: true,
      tenant: { select: { isActive: true } },
    },
  });

  const value: UserAccess | null = user
    ? {
        role: user.role,
        permissions: sanitizePermissions(user.permissions),
        isActive: user.isActive,
        passwordChangedAt: user.passwordChangedAt,
        tenantId: user.tenantId,
        tenantIsActive: user.tenant.isActive,
      }
    : null;

  cache.set(userId, { value, expiresAt: now + ACCESS_CACHE_TTL_MS });
  return value;
}

/// Whether a JWT minted at `authenticatedAt` may still be used. Keeping this
/// decision pure makes the server callback and its security tests agree.
export function canUseSession(
  access: UserAccess | null,
  authenticatedAt: number | null | undefined,
) {
  if (!access?.isActive) return false;
  if (access.role !== 'SUPER_ADMIN' && !access.tenantIsActive) return false;
  if (
    authenticatedAt &&
    access.passwordChangedAt &&
    access.passwordChangedAt.getTime() > authenticatedAt
  ) {
    return false;
  }
  return true;
}

/// Two permission sets are equal when they hold the same grants, regardless of
/// the order the database happened to return them in.
export function samePermissions(a: readonly string[] = [], b: readonly string[] = []) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((value, index) => value === right[index]);
}
