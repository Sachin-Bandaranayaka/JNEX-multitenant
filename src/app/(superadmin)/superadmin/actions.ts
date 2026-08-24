'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

export async function toggleTenantStatus(formData: FormData) {
  const { actor } = await requireSuperAdmin();
  const tenantId = formData.get('tenantId') as string;
  const isActive = formData.get('isActive') === 'true';

  if (!tenantId) {
    throw new Error('Tenant ID is required.');
  }

  try {
    const tenant = await prisma.tenant.update({
      where: {
        id: tenantId,
      },
      data: {
        isActive: !isActive,
      },
    });
    await prisma.auditEvent.create({ data: { actorId: actor.id, tenantId, action: 'TENANT_STATUS_CHANGED', entityType: 'Tenant', entityId: tenantId, metadata: { tenantName: tenant.name, from: isActive ? 'ACTIVE' : 'INACTIVE', to: isActive ? 'INACTIVE' : 'ACTIVE' } } });
  } catch (error) {
    console.error("Error updating tenant status:", error);
  }

  revalidatePath('/superadmin/users');
  revalidatePath(`/superadmin/tenants/${tenantId}`);
  revalidatePath('/superadmin');
}

// --- UPDATED DELETE TENANT ACTION ---
export async function deleteTenant(formData: FormData) {
  await requireSuperAdmin();
  const tenantId = formData.get('tenantId') as string;

  if (!tenantId) {
    throw new Error('Tenant ID is required.');
  }

  throw new Error(
    'Permanent tenant deletion is disabled. Deactivate the tenant to preserve financial and security records.',
  );
}
