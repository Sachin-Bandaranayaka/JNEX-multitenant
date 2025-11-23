// src/app/(authenticated)/settings/page.tsx

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { SettingsForm } from "./settings-form";

export default async function TenantSettingsPage() {
    const session = await getSession();
    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    // Only Admins can access the settings page
    if (session.user.role !== 'ADMIN') {
        return redirect('/unauthorized');
    }

    const tenant = await prisma.tenant.findUnique({
        where: { id: session.user.tenantId },
    });

    if (!tenant) {
        return notFound();
    }

    return (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                <p className="mt-1 text-sm text-muted-foreground">Manage your business profile and integration settings.</p>
            </div>
            <SettingsForm tenant={tenant} />
        </div>
    );
}