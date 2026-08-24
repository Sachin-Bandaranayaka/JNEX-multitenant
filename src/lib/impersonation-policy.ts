export function isImpersonationExpired(expiresAt: unknown, now = Date.now()) {
  return typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now;
}

export function isSideEffectingTenantRead(pathname: string) {
  return pathname === '/api/notifications' ||
    /^\/api\/orders\/[^/]+\/(enhanced-)?tracking$/.test(pathname) ||
    pathname.startsWith('/api/shipping/track/');
}

export function isAllowedImpersonationRequest(pathname: string, method: string) {
  if (pathname === '/api/superadmin/impersonation/end' && method === 'POST') return true;
  if (method !== 'GET' && method !== 'HEAD') return false;
  return !isSideEffectingTenantRead(pathname);
}
