'use server';

import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

const CreateTenantSchema = z.object({
  tenantName: z.string().min(3, 'Tenant name must be at least 3 characters.'),
  adminName: z.string().min(3, 'Admin name must be at least 3 characters.'),
  adminEmail: z.string().email('Invalid email address.'),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  referredById: z.string().optional(),
});

export async function createTenant(prevState: any, formData: FormData) {
  const { actor } = await requireSuperAdmin();
  const validatedFields = CreateTenantSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { tenantName, adminName, adminEmail, adminPassword, referredById } = validatedFields.data;

  try {
    const emailExists = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (emailExists) {
      return { message: 'A user with this email already exists.' };
    }
    
    const hashedPassword = await hash(adminPassword, 12);
    
    await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: tenantName,
          ...(referredById && {
            referredBy: {
              connect: { id: referredById }
            }
          })
        },
      });

      const admin = await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: hashedPassword,
          role: Role.ADMIN,
          tenantId: newTenant.id,
        },
      });
      await tx.auditEvent.create({ data: { actorId: actor.id, tenantId: newTenant.id, action: 'TENANT_CREATED', entityType: 'Tenant', entityId: newTenant.id, metadata: { tenantName, adminUserId: admin.id } } });
    });

  } catch (error) {
    console.error("Error creating tenant:", error);
    return { message: 'Database Error: Failed to create tenant.' };
  }

  // Revalidate all pages that show tenant/user data
  revalidatePath('/superadmin');
  revalidatePath('/superadmin/tenants');
  revalidatePath('/superadmin/users');
  revalidatePath('/superadmin/hierarchy');

  // --- FIX: Redirect to the main dashboard, which we know exists ---
  redirect('/superadmin');
}
