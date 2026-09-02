// src/app/(authenticated)/users/page.tsx

import { Role } from '@prisma/client';
import { Metadata } from 'next';
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getScopedPrismaClient } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UsersClient } from './users-client';

export const metadata: Metadata = {
    title: 'Users',
    description: 'Manage users and their permissions in the system'
};

export default async function UsersPage() {
    const session = await getSession();

    // 1. Secure the page and get the tenantId
    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    // Tenant admins, and any team member the admin has delegated MANAGE_USERS
    // to. The permission used to be offered in the staff form and enforced
    // nowhere, so granting it produced a sidebar link that bounced the holder
    // straight to /unauthorized.
    if (!can(session.user, 'MANAGE_USERS')) {
        return redirect('/unauthorized');
    }

    // 2. Use the scoped client to fetch users for the current tenant only
    const prisma = getScopedPrismaClient(session.user.tenantId);
    
    const usersData = await prisma.user.findMany({
        where: {
            // Exclude SUPER_ADMIN from the list as tenant admins cannot manage them
            role: {
                in: [Role.ADMIN, Role.TEAM_MEMBER],
            },
        },
        orderBy: {
            name: 'asc'
        },
        // Select explicitly: `include` returns every column, which put each
        // staff member's bcrypt hash into the props serialised down to the
        // browser.
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            permissions: true,
            isActive: true,
            createdAt: true,
            _count: {
                select: {
                    orders: true,
                    leads: true,
                }
            }
        }
    });

    // 3. Transform the data to match the client component's expected format
    const users = usersData.map(user => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
        totalOrders: user._count.orders,
        totalLeads: user._count.leads
    }));
    
    // 4. Render the client component with the secure data
    return (
        <UsersClient
            initialUsers={users}
            currentUserId={session.user.id}
            currentUserRole={session.user.role}
            currentUserPermissions={session.user.permissions || []}
        />
    );
}