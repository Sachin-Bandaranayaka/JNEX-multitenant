'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function toggleTenantStatus(formData: FormData) {
  const tenantId = formData.get('tenantId') as string;
  const isActive = formData.get('isActive') === 'true';

  if (!tenantId) {
    throw new Error('Tenant ID is required.');
  }

  try {
    await prisma.tenant.update({
      where: {
        id: tenantId,
      },
      data: {
        isActive: !isActive,
      },
    });
  } catch (error) {
    console.error("Error updating tenant status:", error);
  }

  revalidatePath('/superadmin/users');
}

// --- UPDATED DELETE TENANT ACTION ---
export async function deleteTenant(formData: FormData) {
  const tenantId = formData.get('tenantId') as string;

  if (!tenantId) {
    throw new Error('Tenant ID is required.');
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    if (tenant?.name === 'Master Tenant' || tenant?.name === 'J-nex Holdings Master') {
      console.error("ACTION BLOCKED: Attempted to delete the master tenant.");
      return;
    }

    // --- FIX: Use a transaction to delete all dependent data first ---
    // This ensures data integrity and prevents foreign key constraint errors.
    await prisma.$transaction([
      // Delete all data that depends on the tenant in the correct order
      prisma.stockAdjustment.deleteMany({ where: { tenantId } }),
      prisma.order.deleteMany({ where: { tenantId } }),
      prisma.lead.deleteMany({ where: { tenantId } }),
      prisma.product.deleteMany({ where: { tenantId } }),
      prisma.user.deleteMany({ where: { tenantId } }),
      
      // Finally, delete the tenant itself
      prisma.tenant.delete({ where: { id: tenantId } }),
    ]);

  } catch (error) {
    console.error("Error deleting tenant:", error);
    throw new Error('Failed to delete tenant.');
  }

  revalidatePath('/superadmin/users');
}
