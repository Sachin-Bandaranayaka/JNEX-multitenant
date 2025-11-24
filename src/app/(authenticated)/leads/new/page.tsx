// src/app/(authenticated)/leads/new/page.tsx

import { getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { LeadForm } from '@/components/leads/lead-form';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'New Lead',
    description: 'Add a new lead to the system'
};

export default async function NewLeadPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    // Permission check for creating leads
    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('CREATE_LEADS')) {
        return redirect('/unauthorized');
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);

    // --- FIX: The query now fetches all necessary product fields ---
    const products = await prisma.product.findMany({
        where: {
            isActive: true,
        },
        orderBy: {
            name: 'asc'
        },
        // Remove the 'select' block to fetch all scalar fields,
        // including stock and lowStockAlert.
    });

    return (
        <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">New Lead</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Add a new lead to the system
                    </p>
                </div>
                <Link
                    href="/leads"
                    className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                    <ArrowLeftIcon className="mr-2 h-4 w-4" />
                    Back to Leads
                </Link>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8">
                    <LeadForm products={products} />
                </div>
            </div>
        </div>
    );
}
