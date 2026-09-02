import { describe, expect, it } from 'vitest';
import { PERMISSIONS, can, canAny, sanitizePermissions } from '../permissions';

describe('can', () => {
  it('grants an admin everything, even with an empty permissions array', () => {
    const admin = { role: 'ADMIN', permissions: [] };
    for (const permission of PERMISSIONS) {
      expect(can(admin, permission)).toBe(true);
    }
  });

  it('grants a team member only what they hold', () => {
    const member = { role: 'TEAM_MEMBER', permissions: ['VIEW_ORDERS'] };
    expect(can(member, 'VIEW_ORDERS')).toBe(true);
    expect(can(member, 'CREATE_ORDERS')).toBe(false);
    expect(can(member, 'MANAGE_USERS')).toBe(false);
  });

  it('refuses a missing or signed-out subject', () => {
    expect(can(undefined, 'VIEW_ORDERS')).toBe(false);
    expect(can({ role: null, permissions: ['VIEW_ORDERS'] }, 'VIEW_ORDERS')).toBe(false);
  });

  it('canAny needs only one of the listed grants', () => {
    const member = { role: 'TEAM_MEMBER', permissions: ['UPDATE_SHIPPING_STATUS'] };
    expect(canAny(member, ['EDIT_ORDERS', 'UPDATE_SHIPPING_STATUS'])).toBe(true);
    expect(canAny(member, ['EDIT_ORDERS', 'DELETE_ORDERS'])).toBe(false);
  });
});

describe('sanitizePermissions', () => {
  it('drops values that are not real permissions', () => {
    expect(sanitizePermissions(['VIEW_ORDERS', 'VIEW_INVENTORY', 'nonsense'])).toEqual([
      'VIEW_ORDERS',
    ]);
  });

  it('de-duplicates and tolerates nothing', () => {
    expect(sanitizePermissions(['VIEW_LEADS', 'VIEW_LEADS'])).toEqual(['VIEW_LEADS']);
    expect(sanitizePermissions(undefined)).toEqual([]);
  });
});
