import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AuthenticatedUI from "./authenticated-ui";
import { Tenant } from "@prisma/client";
import { headers } from 'next/headers';
import { getRequestIdentity } from '@/lib/impersonation';

// This function's props interface might need to be updated if you are passing
// the tenant to it from a higher-level layout. For now, this is a safe assumption.
export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.tenantId) {
    return redirect('/auth/signin');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  
  if (!tenant || !tenant.isActive) {
    // This is a more robust way to handle redirects with errors
    const redirectUrl = new URL('/auth/signin', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
    redirectUrl.searchParams.set('error', 'Your account has been deactivated.');
    return redirect(redirectUrl.toString());
  }

  if (session.user.impersonation && session.user.actor?.id) {
    const access = session.user.impersonation;
    const recent = await prisma.auditEvent.findFirst({ where: { impersonationSessionId: access.sessionId, action: 'TENANT_WORKSPACE_VIEWED', createdAt: { gte: new Date(Date.now() - 60_000) } }, select: { id: true } });
    if (!recent) await prisma.auditEvent.create({ data: { actorId: session.user.actor.id, impersonationSessionId: access.sessionId, tenantId: access.tenantId, action: 'TENANT_WORKSPACE_VIEWED', entityType: 'Tenant', entityId: access.tenantId, metadata: { mode: 'READ_ONLY' }, ...getRequestIdentity(await headers()) } });
  }

  // --- FIX: Pass the corrected tenant type to AuthenticatedUI ---
  // This ensures type safety and that all expected fields are present.
  return <AuthenticatedUI tenant={tenant as Tenant}>{children}</AuthenticatedUI>;
}
