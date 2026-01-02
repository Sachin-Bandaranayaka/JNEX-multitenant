// src/app/(superadmin)/superadmin/tenants/[tenantId]/edit/actions.ts

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// --- UPDATED AND MORE ROBUST SCHEMA ---
const UpdateTenantSchema = z.object({
  // FIX: Made name and email optional to prevent validation failure if they are not submitted.
  name: z.string().min(3, 'Tenant name must be at least 3 characters.').optional(),
  email: z.string().email('Please enter a valid email.').optional(),
  businessName: z.string().optional(),

  logoUrl: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url({ message: "Please enter a valid URL." }).optional()
  ),

  backgroundColor: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, { message: "Must be a valid hex color code."}).optional()
  ),
  cardColor: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, { message: "Must be a valid hex color code."}).optional()
  ),
  fontColor: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, { message: "Must be a valid hex color code."}).optional()
  ),
});


export async function updateTenant(tenantId: string, adminUserId: string, formData: FormData): Promise<void> {
  const validatedFields = UpdateTenantSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    console.error("Validation Errors:", validatedFields.error.flatten().fieldErrors);
    throw new Error('Validation failed');
  }
  
  const { name, email, ...brandingSettings } = validatedFields.data;

  try {
    // FIX: We build the data objects conditionally.
    // This ensures we only try to update fields that were actually provided in the form.
    const tenantUpdateData: {
      name?: string;
      businessName?: string | null;
      logoUrl?: string | null;
      backgroundColor?: string | null;
      cardColor?: string | null;
      fontColor?: string | null;
    } = {
      businessName: brandingSettings.businessName || null,
      logoUrl: brandingSettings.logoUrl || null,
      backgroundColor: brandingSettings.backgroundColor || null,
      cardColor: brandingSettings.cardColor || null,
      fontColor: brandingSettings.fontColor || null,
    };
    if (name) {
      tenantUpdateData.name = name;
    }

    const userUpdateData: { email?: string } = {};
    if (email) {
      userUpdateData.email = email;
    }

    // We only run the transaction if there's actually something to update.
    const transactionPromises = [];
    if (Object.keys(tenantUpdateData).length > 0) {
      transactionPromises.push(prisma.tenant.update({
        where: { id: tenantId },
        data: tenantUpdateData,
      }));
    }
    if (Object.keys(userUpdateData).length > 0) {
      transactionPromises.push(prisma.user.update({
        where: { id: adminUserId },
        data: userUpdateData,
      }));
    }

    if(transactionPromises.length > 0) {
      await prisma.$transaction(transactionPromises);
    }

  } catch (error) {
    if ((error as any).code === 'P2002') {
        throw new Error('This email address is already in use.');
    }
    console.error(error);
    throw new Error('Database Error: Failed to update tenant.');
  }

  revalidatePath('/superadmin/users');
  redirect('/superadmin/users');
}

// --- SCHEMA FOR COURIER API KEYS (Super Admin Only) ---
const ApiKeysSchema = z.object({
  defaultShippingProvider: z.enum(['FARDA_EXPRESS', 'TRANS_EXPRESS', 'SL_POST', 'ROYAL_EXPRESS']).optional(),
  fardaExpressClientId: z.string().optional(),
  fardaExpressApiKey: z.string().optional(),
  transExpressApiKey: z.string().optional(),
  royalExpressApiKey: z.string().optional(),
  royalExpressOrderPrefix: z.string().optional(),
});

export async function updateTenantApiKeys(tenantId: string, formData: FormData): Promise<void> {
  const validatedFields = ApiKeysSchema.safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    console.error("Validation Errors:", validatedFields.error.flatten().fieldErrors);
    throw new Error('Validation failed');
  }

  const { 
    defaultShippingProvider,
    fardaExpressClientId, 
    fardaExpressApiKey, 
    transExpressApiKey, 
    royalExpressApiKey,
    royalExpressOrderPrefix 
  } = validatedFields.data;

  try {
    // Build update data, only including non-empty values
    const updateData: {
      defaultShippingProvider?: 'FARDA_EXPRESS' | 'TRANS_EXPRESS' | 'SL_POST' | 'ROYAL_EXPRESS';
      fardaExpressClientId?: string | null;
      fardaExpressApiKey?: string | null;
      transExpressApiKey?: string | null;
      royalExpressApiKey?: string | null;
      royalExpressOrderPrefix?: string | null;
    } = {};

    if (defaultShippingProvider) {
      updateData.defaultShippingProvider = defaultShippingProvider;
    }
    
    // For API keys, we update them if provided (even empty to allow clearing)
    updateData.fardaExpressClientId = fardaExpressClientId || null;
    updateData.fardaExpressApiKey = fardaExpressApiKey || null;
    updateData.transExpressApiKey = transExpressApiKey || null;
    updateData.royalExpressApiKey = royalExpressApiKey || null;
    updateData.royalExpressOrderPrefix = royalExpressOrderPrefix || null;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

  } catch (error) {
    console.error(error);
    throw new Error('Database Error: Failed to update API keys.');
  }

  revalidatePath(`/superadmin/tenants/${tenantId}/edit`);
  redirect(`/superadmin/tenants/${tenantId}/edit`);
}
