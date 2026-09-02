import { describe, expect, it, vi } from 'vitest';

// The policy helpers that touch the database are exercised through a stubbed
// client; the rest are pure.
const count = vi.fn();
const findFirst = vi.fn();
const update = vi.fn();
const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback({
  user: {
    count: (...args: unknown[]) => count(...args),
    findFirst: (...args: unknown[]) => findFirst(...args),
    update: (...args: unknown[]) => update(...args),
  },
}));
vi.mock('../prisma', () => ({
  prisma: {
    user: { count: (...args: unknown[]) => count(...args) },
    auditEvent: { create: vi.fn() },
    $transaction: (callback: (tx: unknown) => unknown) => transaction(callback),
  },
}));

import {
  checkLastAdminRemains,
  checkRoleAssignment,
  checkSelfEdit,
  checkTargetIsManageable,
  permissionsGrantableBy,
  updateStaffWithAdminInvariant,
} from '../staff';

const admin = { id: 'admin-1', role: 'ADMIN', permissions: [] as string[] };
const delegate = {
  id: 'delegate-1',
  role: 'TEAM_MEMBER',
  permissions: ['MANAGE_USERS', 'VIEW_ORDERS'],
};

describe('role assignment', () => {
  it('lets an admin create another admin', () => {
    expect(checkRoleAssignment(admin, 'ADMIN')).toBeNull();
  });

  it('stops a MANAGE_USERS delegate from creating an admin', () => {
    expect(checkRoleAssignment(delegate, 'ADMIN')?.status).toBe(403);
    expect(checkRoleAssignment(delegate, 'TEAM_MEMBER')).toBeNull();
  });
});

describe('target protection', () => {
  it('never exposes a platform account to tenant staff management', () => {
    expect(checkTargetIsManageable(admin, { id: 'x', role: 'SUPER_ADMIN' })?.status).toBe(403);
  });

  it('stops a delegate from editing an admin', () => {
    expect(checkTargetIsManageable(delegate, { id: 'x', role: 'ADMIN' })?.status).toBe(403);
    expect(checkTargetIsManageable(delegate, { id: 'x', role: 'TEAM_MEMBER' })).toBeNull();
  });
});

describe('grant ceiling', () => {
  it('lets an admin grant anything', () => {
    const result = permissionsGrantableBy(admin, ['MANAGE_USERS', 'DELETE_ORDERS']);
    expect(result.rejected).toEqual([]);
    expect(result.permissions).toEqual(['MANAGE_USERS', 'DELETE_ORDERS']);
  });

  it('refuses a delegate handing out access they do not hold', () => {
    const result = permissionsGrantableBy(delegate, ['VIEW_ORDERS', 'DELETE_ORDERS']);
    expect(result.permissions).toEqual(['VIEW_ORDERS']);
    expect(result.rejected).toEqual(['DELETE_ORDERS']);
  });
});

describe('self edit', () => {
  const target = { id: 'admin-1', role: 'ADMIN' as const, permissions: [] as string[] };

  it('refuses demoting yourself', () => {
    expect(
      checkSelfEdit(admin, target, { role: 'TEAM_MEMBER', permissions: [] })?.error,
    ).toMatch(/your own role/);
  });

  it('refuses changing your own permissions', () => {
    const member = { id: 'm', role: 'TEAM_MEMBER', permissions: ['MANAGE_USERS'] };
    expect(
      checkSelfEdit(member, { id: 'm', role: 'TEAM_MEMBER', permissions: ['MANAGE_USERS'] }, {
        role: 'TEAM_MEMBER',
        permissions: ['MANAGE_USERS', 'DELETE_ORDERS'],
      })?.error,
    ).toMatch(/your own permissions/);
  });

  it('allows an unrelated edit to your own profile', () => {
    expect(checkSelfEdit(admin, target, { role: 'ADMIN', permissions: [] })).toBeNull();
  });

  it('ignores someone else entirely', () => {
    expect(
      checkSelfEdit(admin, { id: 'other', role: 'TEAM_MEMBER', permissions: [] }, {
        role: 'ADMIN',
        permissions: [],
      }),
    ).toBeNull();
  });
});

describe('last admin', () => {
  it('refuses demoting the only active admin', async () => {
    count.mockResolvedValueOnce(0);
    const result = await checkLastAdminRemains('tenant-1', { id: 'a', role: 'ADMIN' }, {
      role: 'TEAM_MEMBER',
      isActive: true,
    });
    expect(result?.error).toMatch(/only active admin/);
  });

  it('refuses deactivating the only active admin', async () => {
    count.mockResolvedValueOnce(0);
    const result = await checkLastAdminRemains('tenant-1', { id: 'a', role: 'ADMIN' }, {
      role: 'ADMIN',
      isActive: false,
    });
    expect(result?.error).toMatch(/only active admin/);
  });

  it('allows it when another active admin remains', async () => {
    count.mockResolvedValueOnce(1);
    expect(
      await checkLastAdminRemains('tenant-1', { id: 'a', role: 'ADMIN' }, {
        role: 'TEAM_MEMBER',
        isActive: true,
      }),
    ).toBeNull();
  });

  it('does not query at all for a team member', async () => {
    count.mockClear();
    expect(
      await checkLastAdminRemains('tenant-1', { id: 'a', role: 'TEAM_MEMBER' }, {
        role: 'TEAM_MEMBER',
        isActive: false,
      }),
    ).toBeNull();
    expect(count).not.toHaveBeenCalled();
  });
});

describe('atomic staff updates', () => {
  it('checks the invariant and updates in the same transaction', async () => {
    findFirst.mockResolvedValueOnce({ id: 'a', role: 'ADMIN' });
    count.mockResolvedValueOnce(1);
    update.mockResolvedValueOnce({ id: 'a', role: 'TEAM_MEMBER', isActive: true });

    const result = await updateStaffWithAdminInvariant({
      tenantId: 'tenant-1',
      userId: 'a',
      next: { role: 'TEAM_MEMBER', isActive: true },
      data: { role: 'TEAM_MEMBER' },
    });

    expect(result.ok).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does not update when the target is the last active admin', async () => {
    findFirst.mockResolvedValueOnce({ id: 'a', role: 'ADMIN' });
    count.mockResolvedValueOnce(0);
    update.mockClear();

    const result = await updateStaffWithAdminInvariant({
      tenantId: 'tenant-1',
      userId: 'a',
      next: { isActive: false },
      data: { isActive: false },
    });

    expect(result).toMatchObject({ ok: false, failure: { status: 400 } });
    expect(update).not.toHaveBeenCalled();
  });
});
