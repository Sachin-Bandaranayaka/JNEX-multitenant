// src/app/api/auth/session-status/route.ts

import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshUserAccess, samePermissions } from "@/lib/user-access";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Add this line to tell Next.js to always run this route dynamically
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ active: false });
    }

    const actorId = session.user.actor?.id || session.user.id;
    const [actor, effectiveUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: actorId }, select: { role: true, isActive: true, passwordChangedAt: true } }),
      prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        isActive: true,
        tenant: {
          select: { isActive: true }
        }
      },
    })]);

    // If the user doesn't exist or their tenant is inactive, session is invalid
    if (!actor || actor.role !== session.user.originalRole || !actor.isActive || !effectiveUser?.isActive || !effectiveUser.tenant.isActive) {
      return NextResponse.json({ active: false });
    }

    // A password reset evicts every session that was signed in with the old
    // password. Without this a stolen session survives the very recovery step
    // taken to stop it, because JWT sessions carry no server-side handle to
    // revoke.
    const authenticatedAt = session.user.authenticatedAt;
    if (
      authenticatedAt &&
      actor.passwordChangedAt &&
      actor.passwordChangedAt.getTime() > authenticatedAt
    ) {
      return NextResponse.json({ active: false, reason: 'password-changed' });
    }

    // Middleware reads the cookie directly and cannot refresh it, so a staff
    // member whose permissions were just changed would keep the old routing
    // rules until something else happened to re-mint the JWT. Compare what the
    // cookie still claims against the database and ask the client to refresh
    // its session when the two have drifted apart.
    const rawToken = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    let stale = false;
    if (rawToken && !rawToken.impersonationSessionId) {
      const access = await getFreshUserAccess(actorId);
      stale = Boolean(
        access &&
          (access.role !== rawToken.role ||
            !samePermissions(access.permissions, (rawToken.permissions as string[]) || [])),
      );
    }

    // If all checks pass, the session is valid
    return NextResponse.json({ active: true, stale });

  } catch (error) {
    console.error("Session status check error:", error);
    // In case of any error, treat the session as inactive for security
    return NextResponse.json({ active: false });
  }
}
