// src/app/(superadmin)/superadmin/create/page.tsx

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { CreateTenantForm } from './create-tenant-form';
import { PageHeader } from '../ui';

export default async function CreateTenantPage() {

    // Fetch all existing tenants to populate the referrer dropdown
    const tenants = await prisma.tenant.findMany({
        orderBy: { name: 'asc' }
    });

    return (
        <div className="space-y-8">
            <PageHeader
                eyebrow="Tenant provisioning"
                title="Create a new tenant"
                description="This creates a new tenant account and its initial admin user."
                backHref="/superadmin/users"
                backLabel="Back to tenants"
            />
            <CreateTenantForm tenants={tenants} />
        </div>
    );
}
