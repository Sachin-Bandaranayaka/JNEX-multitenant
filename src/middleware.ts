import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Role } from '@prisma/client';

const permissionMap: Record<string, string> = {
  '/dashboard': 'VIEW_DASHBOARD',
  '/orders': 'VIEW_ORDERS',
  '/leads': 'VIEW_LEADS',
  '/products': 'VIEW_PRODUCTS',
  '/inventory': 'EDIT_STOCK_LEVELS',
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
  if (isPublicAsset(pathname) || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const userRole = token?.role as Role;
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

      if (userRole === 'SUPER_ADMIN') {
        landingPage = '/superadmin';
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
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Super Admin Access
  if (userRole === 'SUPER_ADMIN') {
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
