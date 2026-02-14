// src/app/(superadmin)/superadmin/create/page.tsx

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { CreateTenantForm } from './create-tenant-form';

export default async function CreateTenantPage() {

    // Fetch all existing tenants to populate the referrer dropdown
    const tenants = await prisma.tenant.findMany({
        orderBy: { name: 'asc' }
    });

    return (
        <div className="rounded-lg bg-gray-800/80 p-6 sm:p-8 ring-1 ring-white/10">
            <h2 className="text-2xl font-bold leading-7 text-white">
                Create a New Tenant
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-300">
                This will create a new tenant account and an initial admin user for that tenant.
            </p>
            <CreateTenantForm tenants={tenants} />
        </div>
    );
}