// src/app/(authenticated)/leads/[leadId]/page.tsx

import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { LeadDetailsClient } from '@/components/leads/lead-details-client'; // Import the new client component
import { Prisma, User as PrismaUser, Lead as PrismaLead, Product } from '@prisma/client';
import { User } from 'next-auth';

interface LeadDetailsPageProps {
    params: Promise<{
        leadId: string;
    }>;
}

export const metadata: Metadata = {
    title: 'Lead Details',
    description: 'View and manage lead details'
};

// Define a reusable type for the lead data
export type LeadWithRelations = Prisma.LeadGetPayload<{
    include: {
        product: true;
        assignedTo: { select: { id: true, name: true, email: true } };
        order: { include: { product: true } };
        reminders: {
            where: { status: 'PENDING' };
            orderBy: { remindAt: 'asc' };
            take: 1;
        };
    }
}>;

export default async function LeadDetailsPage({ params }: LeadDetailsPageProps) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        redirect('/auth/signin');
    }

    const resolvedParams = await params;
    const prisma = getScopedPrismaClient(session.user.tenantId);

    const lead = await prisma.lead.findUnique({
        where: { id: resolvedParams.leadId },
        include: {
            product: true,
            assignedTo: { select: { id: true, name: true, email: true } },
            reminders: {
                where: { status: 'PENDING' },
                orderBy: { remindAt: 'asc' },
                take: 1,
            },
            order: { include: { product: true } }
        }
    });

    if (!lead) {
        return <div className="p-4 text-red-400">Lead not found.</div>;
    }

    // --- PERMISSION CHECK ---
    // An admin can see any lead. A team member can only see leads they are assigned to.
    const isOwner = lead.userId === session.user.id;
    if (session.user.role !== 'ADMIN' && !isOwner) {
        return redirect('/unauthorized');
    }
    
    // Fetch all products to pass to the edit form
    const products = await prisma.product.findMany();

    // Pass all necessary data to the new client component
    return (
        <LeadDetailsClient 
            initialLead={lead as LeadWithRelations} 
            products={products}
            user={session.user as User} 
        />
    );
}
