import { NextResponse } from 'next/server';
import { getScopedPrismaClient } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { Prisma, Role } from '@prisma/client';
import { requirePermission } from '@/lib/authz';
import { PERMISSIONS } from '@/lib/permissions';
import { validatePassword } from '@/lib/password-policy';
import { invalidateUserAccess } from '@/lib/user-access';
import {
  checkRoleAssignment,
  checkSelfEdit,
  checkTargetIsManageable,
  permissionsGrantableBy,
  recordStaffEvent,
  updateStaffWithAdminInvariant,
} from '@/lib/staff';

export const dynamic = 'force-dynamic';

const userUpdateSchema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  email: z.string().trim().email('Invalid email address').max(254),
  role: z.enum([Role.ADMIN, Role.TEAM_MEMBER]),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
  // Blank means "leave the password alone"; the form sends an empty string
  // when the admin is not resetting it.
  password: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
});

// --- UPDATE User ---
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const guard = await requirePermission('MANAGE_USERS');
    if (!guard.ok) return guard.response;

    const actor = {
      id: guard.session.user.id,
      role: guard.session.user.role,
      permissions: guard.session.user.permissions,
    };

    const prisma = getScopedPrismaClient(guard.tenantId);
    const body = await request.json();
    const validatedData = userUpdateSchema.parse(body);

    const userToUpdate = await prisma.user.findUnique({ where: { id: resolvedParams.id } });
    if (!userToUpdate) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetProblem = checkTargetIsManageable(actor, userToUpdate);
    if (targetProblem) {
      return NextResponse.json({ error: targetProblem.error }, { status: targetProblem.status });
    }

    const roleProblem = checkRoleAssignment(actor, validatedData.role);
    if (roleProblem) {
      return NextResponse.json({ error: roleProblem.error }, { status: roleProblem.status });
    }

    const { permissions, rejected } = permissionsGrantableBy(actor, validatedData.permissions ?? []);
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: 'You can only grant access that you hold yourself.', details: rejected },
        { status: 403 },
      );
    }

    // Admins hold every permission implicitly.
    const storedPermissions = validatedData.role === Role.ADMIN ? [] : permissions;
    const isActive = validatedData.isActive ?? userToUpdate.isActive;

    const selfProblem = checkSelfEdit(actor, userToUpdate, {
      role: validatedData.role,
      permissions: storedPermissions,
    });
    if (selfProblem) {
      return NextResponse.json({ error: selfProblem.error }, { status: selfProblem.status });
    }
    if (actor.id === userToUpdate.id && !isActive) {
      return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 });
    }

    let hashedPassword: string | undefined;
    if (validatedData.password) {
      const passwordProblem = validatePassword(validatedData.password);
      if (passwordProblem) {
        return NextResponse.json({ error: passwordProblem }, { status: 400 });
      }
      hashedPassword = await hash(validatedData.password, 12);
    }

    const updateResult = await updateStaffWithAdminInvariant({
      tenantId: guard.tenantId,
      userId: resolvedParams.id,
      next: { role: validatedData.role, isActive },
      data: {
        name: validatedData.name,
        email: validatedData.email,
        role: validatedData.role,
        permissions: storedPermissions,
        isActive,
        // Setting a new password evicts the sessions minted with the old one --
        // the whole point of resetting a staff member's password.
        ...(hashedPassword ? { password: hashedPassword, passwordChangedAt: new Date() } : {}),
      },
    });
    if (!updateResult.ok) {
      return NextResponse.json(
        { error: updateResult.failure.error },
        { status: updateResult.failure.status },
      );
    }
    const updatedUser = updateResult.user;

    invalidateUserAccess(updatedUser.id);
    await recordStaffEvent({
      actorId: actor.id,
      tenantId: guard.tenantId,
      action: 'STAFF_ACCOUNT_UPDATED',
      targetId: updatedUser.id,
      metadata: {
        role: updatedUser.role,
        permissions: storedPermissions,
        isActive,
        passwordReset: Boolean(hashedPassword),
      },
    });

    const { password: _password, ...safeUser } = updatedUser;
    return NextResponse.json(safeUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data provided', details: error.errors }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 400 });
    }
    console.error("Update User Error:", error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// --- DEACTIVATE User ---
//
// This used to be a hard `prisma.user.delete`, which could not succeed for any
// staff member who had ever taken an order: Order.assignedTo is a required
// relation, so the database refused the delete and the admin was shown a bare
// "Failed to delete user". Deactivating keeps the orders, leads and audit
// trail attached to the person who did the work, stops them signing in, and is
// reversible -- the create endpoint already knows how to revive an inactive
// account.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const guard = await requirePermission('MANAGE_USERS');
    if (!guard.ok) return guard.response;

    const actor = {
      id: guard.session.user.id,
      role: guard.session.user.role,
      permissions: guard.session.user.permissions,
    };

    // Safety check: Prevent a user from deleting themselves.
    if (actor.id === resolvedParams.id) {
        return NextResponse.json({ error: 'You cannot remove your own account.' }, { status: 400 });
    }

    const prisma = getScopedPrismaClient(guard.tenantId);

    const userToRemove = await prisma.user.findUnique({ where: { id: resolvedParams.id } });
    if (!userToRemove) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetProblem = checkTargetIsManageable(actor, userToRemove);
    if (targetProblem) {
      return NextResponse.json({ error: targetProblem.error }, { status: targetProblem.status });
    }

    if (userToRemove.isActive) {
      const updateResult = await updateStaffWithAdminInvariant({
        tenantId: guard.tenantId,
        userId: resolvedParams.id,
        next: { isActive: false },
        data: { isActive: false },
      });
      if (!updateResult.ok) {
        return NextResponse.json(
          { error: updateResult.failure.error },
          { status: updateResult.failure.status },
        );
      }
    }

    invalidateUserAccess(resolvedParams.id);
    await recordStaffEvent({
      actorId: actor.id,
      tenantId: guard.tenantId,
      action: 'STAFF_ACCOUNT_DEACTIVATED',
      targetId: resolvedParams.id,
      metadata: { email: userToRemove.email },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Deactivate User Error:", error);
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 });
  }
}
