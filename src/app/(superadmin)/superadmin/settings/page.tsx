// src/app/(superadmin)/superadmin/settings/page.tsx

export const dynamic = 'force-dynamic';

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { SettingsClient } from "./settings-client";

export default async function SuperAdminSettingsPage() {
    const session = await getSession();

    if (!session?.user) {
        redirect('/auth/signin');
    }

    // Fetch all users with the SUPER_ADMIN role
    const superAdmins = await prisma.user.findMany({
        where: { role: Role.SUPER_ADMIN },
        orderBy: { name: 'asc' }
    });

    return (
        <SettingsClient currentSession={session} superAdmins={superAdmins} />
    );
}