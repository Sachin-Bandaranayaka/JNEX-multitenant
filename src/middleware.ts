import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Role } from '@prisma/client';
import { isAllowedImpersonationRequest, isImpersonationExpired } from '@/lib/impersonation-policy';

const permissionMap: Record<string, string> = {
  '/dashboard': 'VIEW_DASHBOARD',
  '/orders': 'VIEW_ORDERS',
  '/leads': 'VIEW_LEADS',
  '/products': 'VIEW_PRODUCTS',
  '/inventory': 'VIEW_PRODUCTS',
  '/shipping': 'VIEW_SHIPPING',
  '/reports': 'VIEW_REPORTS',
};

const orderedRoutes = [
    '/dashboard',
    '/orders',
    '/leads',
    '/products',
    '/inventory',
    '/shipping',
    '/reports',
];

const publicAssetPrefixes = ['/brand/', '/icons/', '/IMAGES/', '/templates/'];
const publicAssetFiles = new Set([
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/Trans Express Main.postman_collection.json',
]);

function isPublicAsset(pathname: string) {
  const isWorkboxRuntime = pathname.startsWith('/workbox-') && pathname.endsWith('.js');
  return isWorkboxRuntime || publicAssetFiles.has(pathname) || publicAssetPrefixes.some(prefix => pathname.startsWith(prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public files must remain available before authentication (sign-in branding,
  // PWA metadata, icons, and downloadable templates).
  const publicApi = pathname.startsWith('/api/auth/') || pathname.startsWith('/api/cron/') || pathname === '/api/health';
  if (isPublicAsset(pathname) || publicApi) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const userRole = token?.role as Role;
  const originalRole = (token?.actorRole || token?.role) as Role;
  const isImpersonating = Boolean(token?.impersonationSessionId && originalRole === 'SUPER_ADMIN');
  const impersonationExpired = isImpersonating && isImpersonationExpired(token?.impersonationExpiresAt);
  const userPermissions = (token?.permissions as string[]) || [];

  // --- FIX: Explicitly allow access to the unauthorized page to prevent redirect loops ---
  if (pathname === '/unauthorized') {
    return NextResponse.next();
  }

  // Intelligent redirect for authenticated users on an auth page
  const isAuthPage = pathname.startsWith('/auth');
  if (isAuthPage) {
    if (token) {
      let landingPage = '/unauthorized'; // Default to unauthorized

      if (originalRole === 'SUPER_ADMIN' && !isImpersonating) {
        landingPage = '/superadmin';
      } else if (isImpersonating) {
        landingPage = '/dashboard';
      } else if (userRole === 'ADMIN') {
        landingPage = '/dashboard';
      } else if (userRole === 'TEAM_MEMBER') {
        const allowedPage = orderedRoutes.find(route => {
            const requiredPermission = permissionMap[route];
            return requiredPermission && userPermissions.includes(requiredPermission);
        });
        if (allowedPage) {
            landingPage = allowedPage;
        }
      }
      return NextResponse.redirect(new URL(landingPage, request.url));
    }
    return null;
  }

  // If user is not authenticated and not on an auth page, redirect to sign-in
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (impersonationExpired) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Read-only access has expired.' }, { status: 401 });
    return NextResponse.redirect(new URL('/superadmin/users?access=expired', request.url));
  }

  if (isImpersonating) {
    // Keep the temporary identity inside the tenant workspace. Returning to
    // owner controls requires ending custody first so the UI and audit trail
    // cannot mix actor and effective-tenant contexts.
    if (pathname.startsWith('/superadmin')) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Exit read-only tenant access before returning to Super Admin controls.' },
          { status: 403 },
        );
      }
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (!isAllowedImpersonationRequest(pathname, request.method)) {
      return NextResponse.json(
        { error: 'This action is unavailable during read-only Super Admin access.' },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  // Super Admin Access
  if (originalRole === 'SUPER_ADMIN') {
    if (!pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/superadmin', request.url));
    }
    return NextResponse.next();
  }
  
  // Prevent non-superadmins from accessing superadmin area
  if (pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  // Tenant Admin Access
  if (userRole === 'ADMIN') {
    return NextResponse.next();
  }

  // Team Member Permission Check
  if (userRole === 'TEAM_MEMBER') {
    const requiredPermissionKey = Object.keys(permissionMap).find(path => pathname.startsWith(path));
    
    if (!requiredPermissionKey) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    const requiredPermission = permissionMap[requiredPermissionKey];
    if (!userPermissions.includes(requiredPermission)) {
        return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Public files that reach middleware are handled by the narrow allowlist
  // above; all non-static application routes remain protected here.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
