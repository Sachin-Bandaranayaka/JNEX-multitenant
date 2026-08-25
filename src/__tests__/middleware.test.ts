import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const getToken = vi.fn();
vi.mock('next-auth/jwt', () => ({ getToken: (...args: unknown[]) => getToken(...args) }));


function request(pathname: string, method = 'GET') {
  return new NextRequest(new URL(`https://app.example.com${pathname}`), { method });
}

beforeEach(() => getToken.mockReset());

describe('super admin API access', () => {
  beforeEach(() => getToken.mockResolvedValue({ role: 'SUPER_ADMIN' }));

  it.each([
    '/api/store/products',
    '/api/store/upload',
    '/api/superadmin/impersonation/start',
  ])('passes %s through instead of redirecting to an HTML page', async (path) => {
    const response = await middleware(request(path, 'POST'));
    expect(response?.status).toBe(200);
    expect(response?.headers.get('location')).toBeNull();
  });

  it('still redirects non-API pages to the owner console', async () => {
    const response = await middleware(request('/orders'));
    expect(response?.headers.get('location')).toContain('/superadmin');
  });
});

describe('non-super-admin hitting super admin APIs', () => {
  it('gets JSON 403, not an HTML redirect', async () => {
    getToken.mockResolvedValue({ role: 'ADMIN' });
    const response = await middleware(request('/api/superadmin/impersonation/start', 'POST'));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: 'Forbidden' });
  });
});

describe('team member API access', () => {
  const withPermissions = (permissions: string[]) =>
    getToken.mockResolvedValue({ role: 'TEAM_MEMBER', permissions });

  it('allows a permitted feature API', async () => {
    withPermissions(['VIEW_ORDERS']);
    const response = await middleware(request('/api/orders/order-1/status', 'PATCH'));
    expect(response?.status).toBe(200);
    expect(response?.headers.get('location')).toBeNull();
  });

  it('allows shared dashboard chrome APIs with no feature permission', async () => {
    withPermissions([]);
    for (const path of ['/api/search', '/api/notifications']) {
      expect((await middleware(request(path)))?.status).toBe(200);
    }
  });

  it('denies a feature API the member lacks permission for', async () => {
    withPermissions(['VIEW_ORDERS']);
    const response = await middleware(request('/api/reports/sales'));
    expect(response?.status).toBe(403);
  });

  it('denies unmapped admin APIs', async () => {
    withPermissions(['VIEW_ORDERS', 'VIEW_LEADS', 'VIEW_PRODUCTS', 'VIEW_SHIPPING', 'VIEW_REPORTS']);
    for (const path of ['/api/users', '/api/store/products', '/api/billing/payments']) {
      expect((await middleware(request(path, 'POST')))?.status).toBe(403);
    }
  });

  it('never answers an API call with a redirect to /unauthorized', async () => {
    withPermissions([]);
    const response = await middleware(request('/api/orders'));
    expect(response?.headers.get('location')).toBeNull();
  });

  it('still redirects unauthorised page loads', async () => {
    withPermissions([]);
    const response = await middleware(request('/orders'));
    expect(response?.headers.get('location')).toContain('/unauthorized');
  });
});

describe('unauthenticated', () => {
  it('answers API calls with JSON 401', async () => {
    getToken.mockResolvedValue(null);
    const response = await middleware(request('/api/orders'));
    expect(response?.status).toBe(401);
  });
});
