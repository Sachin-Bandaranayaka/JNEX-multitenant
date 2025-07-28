import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient } from '@/lib/prisma';
import { z } from 'zod';

const userUpdateSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'TEAM_MEMBER']),
  permissions: z.array(z.string()).optional(),
});

// --- UPDATE User ---
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    
    const resolvedParams = await params;const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId || session.user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);
    const body = await request.json();
    const validatedData = userUpdateSchema.parse(body);
    
    const userToUpdate = await prisma.user.findUnique({ where: { id: resolvedParams.id } });
    if (!userToUpdate) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: resolvedParams.id },
      data: {
        name: validatedData.name,
        email: validatedData.email,
        role: validatedData.role,
        permissions: validatedData.role === 'ADMIN' ? [] : validatedData.permissions, // Admins don't need permissions array
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Update User Error:", error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// --- FIX: CHANGED TO PERMANENT (HARD) DELETE ---
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    
    const resolvedParams = await params;const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId || session.user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Safety check: Prevent a user from deleting themselves.
    if (session.user.id === resolvedParams.id) {
        return NextResponse.json({ error: 'You cannot delete yourself.' }, { status: 400 });
    }

    const prisma = getScopedPrismaClient(session.user.tenantId);
    
    // --- CHANGE FROM SOFT DELETE TO HARD DELETE ---
    // This now permanently removes the user from the database.
    await prisma.user.delete({
      where: { id: resolvedParams.id },
    });

    return new NextResponse(null, { status: 204 }); // 204 No Content is standard for successful deletions
  } catch (error) {
    console.error("Delete User Error:", error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
