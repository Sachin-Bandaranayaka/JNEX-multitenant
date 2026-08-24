import { describe, expect, it } from 'vitest';
import { isAllowedImpersonationRequest, isImpersonationExpired, isSideEffectingTenantRead } from '../impersonation-policy';

describe('read-only impersonation request policy', () => {
  it('allows ordinary page and API reads', () => {
    expect(isAllowedImpersonationRequest('/orders', 'GET')).toBe(true);
    expect(isAllowedImpersonationRequest('/api/orders', 'GET')).toBe(true);
    expect(isAllowedImpersonationRequest('/api/orders', 'HEAD')).toBe(true);
  });

  it('blocks every tenant write method', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(isAllowedImpersonationRequest('/api/orders', method)).toBe(false);
    }
  });

  it('allows only the explicit custody exit mutation', () => {
    expect(isAllowedImpersonationRequest('/api/superadmin/impersonation/end', 'POST')).toBe(true);
    expect(isAllowedImpersonationRequest('/api/superadmin/impersonation/start', 'POST')).toBe(false);
  });

  it('blocks GET handlers known to refresh or mutate state', () => {
    for (const path of ['/api/notifications', '/api/orders/order-1/tracking', '/api/orders/order-1/enhanced-tracking', '/api/shipping/track/ABC']) {
      expect(isSideEffectingTenantRead(path)).toBe(true);
      expect(isAllowedImpersonationRequest(path, 'GET')).toBe(false);
    }
  });

  it('treats missing, invalid, and elapsed expiry claims as expired', () => {
    expect(isImpersonationExpired(undefined)).toBe(true);
    expect(isImpersonationExpired('not-a-date')).toBe(true);
    expect(isImpersonationExpired('2026-01-01T00:00:00.000Z', Date.parse('2026-01-01T00:00:00.000Z'))).toBe(true);
    expect(isImpersonationExpired('2026-01-01T00:00:01.000Z', Date.parse('2026-01-01T00:00:00.000Z'))).toBe(false);
  });
});
