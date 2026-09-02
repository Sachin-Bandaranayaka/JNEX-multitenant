import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma', () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { canUseSession, type UserAccess } from '../user-access';

const activeAccess: UserAccess = {
  role: 'TEAM_MEMBER',
  permissions: ['VIEW_ORDERS'],
  isActive: true,
  tenantId: 'tenant-1',
  tenantIsActive: true,
  passwordChangedAt: null,
};

describe('canUseSession', () => {
  it('rejects missing and deactivated users', () => {
    expect(canUseSession(null, Date.now())).toBe(false);
    expect(canUseSession({ ...activeAccess, isActive: false }, Date.now())).toBe(false);
  });

  it('rejects a tenant user when the tenant is inactive', () => {
    expect(canUseSession({ ...activeAccess, tenantIsActive: false }, Date.now())).toBe(false);
  });

  it('does not tie a platform owner session to tenant activation', () => {
    expect(canUseSession({
      ...activeAccess,
      role: 'SUPER_ADMIN',
      tenantIsActive: false,
    }, Date.now())).toBe(true);
  });

  it('rejects credentials older than the latest password change', () => {
    const authenticatedAt = Date.now();
    expect(canUseSession({
      ...activeAccess,
      passwordChangedAt: new Date(authenticatedAt + 1),
    }, authenticatedAt)).toBe(false);
    expect(canUseSession({
      ...activeAccess,
      passwordChangedAt: new Date(authenticatedAt - 1),
    }, authenticatedAt)).toBe(true);
  });
});
