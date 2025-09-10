// src/app/(authenticated)/leads/page.tsx

import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { LeadsClient } from './leads-client'; // Import the new client component
import { Prisma, User as PrismaUser, Lead as PrismaLead, Product } from '@prisma/client';
import { User } from 'next-auth';

// Define a more specific type for our lead data
export type LeadWithDetails = PrismaLead & {
  product: Product;
  assignedTo: PrismaUser | null;
  order: { 
    id: string;
    status: string;
    customerName: string;
    customerPhone: string;
    customerSecondPhone: string | null;
    customerAddress: string;
    customerCity: string | null;
    quantity: number;
    discount: number | null;
    shippingProvider: string | null;
    trackingNumber: string | null;
  } | null;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  
  // 1. SECURE THE PAGE
  if (!session?.user?.tenantId) {
    return redirect('/auth/signin');
  }
  
  // Redirect if a team member without VIEW_LEADS tries to access
  if (session.user.role === 'TEAM_MEMBER' && !session.user.permissions?.includes('VIEW_LEADS')) {
      return redirect('/unauthorized');
  }

  // 2. USE SCOPED PRISMA CLIENT
  const prisma = getScopedPrismaClient(session.user.tenantId);
  
  // 3. BUILD SECURE WHERE CLAUSE
  const where: Prisma.LeadWhereInput = {};
  if (session.user.role === 'TEAM_MEMBER') {
    where.userId = session.user.id;
  }

  // 4. FETCH SECURE DATA
  const [leads, tenant] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        product: true,
        assignedTo: true,
        order: { 
          select: { 
            id: true, 
            status: true,
            customerName: true,
            customerPhone: true,
            customerSecondPhone: true,
            customerAddress: true,
            customerCity: true,
            quantity: true,
            discount: true,
            shippingProvider: true,
            trackingNumber: true
          } 
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    // Get tenant configuration for shipping providers
    globalPrisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: {
        fardaExpressClientId: true,
        fardaExpressApiKey: true,
        transExpressApiKey: true,
        royalExpressApiKey: true,
        royalExpressOrderPrefix: true,
      }
    })
  ]);

  // 5. PASS DATA TO CLIENT COMPONENT
  const resolvedSearchParams = await searchParams;
  return (
    <LeadsClient 
        initialLeads={leads as LeadWithDetails[]} 
        user={session.user as User}
        searchParams={resolvedSearchParams}
        tenantConfig={tenant ? {
          fardaExpressClientId: tenant.fardaExpressClientId || undefined,
          fardaExpressApiKey: tenant.fardaExpressApiKey || undefined,
          transExpressApiKey: tenant.transExpressApiKey || undefined,
          royalExpressApiKey: tenant.royalExpressApiKey || undefined,
          royalExpressOrderPrefix: tenant.royalExpressOrderPrefix || undefined,
        } : undefined}
    />
  );
}