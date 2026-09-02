// src/app/api/users/route.ts

import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { requirePermission } from '@/lib/authz';
import { PERMISSIONS } from '@/lib/permissions';
import { validatePassword } from '@/lib/password-policy';
import { invalidateUserAccess } from '@/lib/user-access';
import {
  ASSIGNABLE_ROLES,
  checkRoleAssignment,
  checkTargetIsManageable,
  permissionsGrantableBy,
  recordStaffEvent,
} from '@/lib/staff';

export const dynamic = 'force-dynamic';

const UserSchema = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1),
  password: z.string().min(1).max(200),
  // Tenant endpoints assign tenant roles only. `z.nativeEnum(Role)` used to be
  // here, which accepted SUPER_ADMIN and let a tenant admin mint a platform
  // account with access to every other tenant.
  role: z.enum([Role.ADMIN, Role.TEAM_MEMBER]),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
});

// GET handler remains the same
export async function GET() {
  try {
    const guard = await requirePermission('MANAGE_USERS');
    if (!guard.ok) return guard.response;

    const prisma = getScopedPrismaClient(guard.tenantId);

    const users = await prisma.user.findMany({
      where: { role: { in: [...ASSIGNABLE_ROLES] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, role: true, createdAt: true, permissions: true,
        isActive: true,
        _count: { select: { orders: true, leads: true } }
      }
    });

    return NextResponse.json(users.map(user => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      totalOrders: user._count.orders,
      totalLeads: user._count.leads
    })));
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requirePermission('MANAGE_USERS');
    if (!guard.ok) return guard.response;

    const actor = {
      id: guard.session.user.id,
      role: guard.session.user.role,
      permissions: guard.session.user.permissions,
    };

    const prisma = getScopedPrismaClient(guard.tenantId);
    const data = await request.json();
    const validatedData = UserSchema.parse(data);

    const passwordProblem = validatePassword(validatedData.password);
    if (passwordProblem) {
      return NextResponse.json({ error: passwordProblem }, { status: 400 });
    }

    const roleProblem = checkRoleAssignment(actor, validatedData.role);
    if (roleProblem) {
      return NextResponse.json({ error: roleProblem.error }, { status: roleProblem.status });
    }

    const { permissions, rejected } = permissionsGrantableBy(actor, validatedData.permissions);
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: 'You can only grant access that you hold yourself.', details: rejected },
        { status: 403 },
      );
    }

    // An admin holds every permission implicitly, so storing a list for them
    // would only ever go stale.
    const storedPermissions = validatedData.role === Role.ADMIN ? [] : permissions;

    // Find if a user exists with this email, regardless of active status
    const existingUser = await prisma.user.findFirst({
        where: { email: validatedData.email }
    });

    const hashedPassword = await hash(validatedData.password, 12);
    let user;

    if (existingUser) {
        // If the user exists but is INACTIVE, reactivate and update them.
        if (!existingUser.isActive) {
            const targetProblem = checkTargetIsManageable(actor, existingUser);
            if (targetProblem) {
              return NextResponse.json(
                { error: targetProblem.error },
                { status: targetProblem.status },
              );
            }
            user = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    name: validatedData.name,
                    password: hashedPassword,
                    passwordChangedAt: new Date(),
                    role: validatedData.role,
                    permissions: storedPermissions,
                    isActive: true, // Reactivate the user
                }
            });
        } else {
            // If the user exists and is ACTIVE, return an error.
            return NextResponse.json({ error: 'An active user with this email already exists.' }, { status: 400 });
        }
    } else {
        // If no user exists, create a new one.
        user = await prisma.user.create({
            data: {
                email: validatedData.email,
                name: validatedData.name,
                password: hashedPassword,
                passwordChangedAt: new Date(),
                role: validatedData.role,
                permissions: storedPermissions,
                isActive: true,
                tenant: {
                    connect: { id: guard.tenantId },
                },
            },
        });
    }

    invalidateUserAccess(user.id);
    await recordStaffEvent({
      actorId: actor.id,
      tenantId: guard.tenantId,
      action: existingUser ? 'STAFF_ACCOUNT_REACTIVATED' : 'STAFF_ACCOUNT_CREATED',
      targetId: user.id,
      metadata: { email: user.email, role: user.role, permissions: storedPermissions },
    });

    const { password: _password, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Error creating/updating user:', error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid data provided', details: error.errors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
