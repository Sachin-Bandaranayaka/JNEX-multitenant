// src/app/api/auth/session-status/route.ts

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Add this line to tell Next.js to always run this route dynamically
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ active: false });
    }

    const actorId = session.user.actor?.id || session.user.id;
    const [actor, effectiveUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: actorId }, select: { role: true, isActive: true } }),
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

    // If all checks pass, the session is valid
    return NextResponse.json({ active: true });

  } catch (error) {
    console.error("Session status check error:", error);
    // In case of any error, treat the session as inactive for security
    return NextResponse.json({ active: false });
  }
}
