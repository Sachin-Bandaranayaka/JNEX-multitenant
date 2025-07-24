'use server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { ShippingProvider } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcryptjs'; // Import bcrypt for hashing

// --- SCHEMA FOR TENANT DETAILS ---
const settingsSchema = z.object({
  businessName: z.string().optional(),
  businessAddress: z.string().optional(),
  businessPhone: z.string().optional(),
  invoicePrefix: z.string().optional(),
  defaultShippingProvider: z.nativeEnum(ShippingProvider).optional(),
  fardaExpressClientId: z.string().optional(),
  fardaExpressApiKey: z.string().optional(),
  transExpressApiKey: z.string().optional(),
  royalExpressApiKey: z.string().optional(),
});

// --- NEW SCHEMA FOR PASSWORD CHANGE ---
const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"], // Point the error to the confirmPassword field
});


export async function updateTenantSettings(
  prevState: { message: string, status: 'error' | 'success' } | undefined,
  formData: FormData
): Promise<{ status: 'error' | 'success', message: string }> {
  const session = await getSession();

  if (!session?.user?.tenantId || session.user.role !== 'ADMIN') {
    return { status: 'error' as const, message: 'Unauthorized' };
  }

  const formValues = Object.fromEntries(formData.entries());

  try {
    const validatedData = settingsSchema.parse(formValues);
    
    const dataToUpdate: Partial<typeof validatedData> = { ...validatedData };
    if (!dataToUpdate.fardaExpressApiKey) delete dataToUpdate.fardaExpressApiKey;
    if (!dataToUpdate.transExpressApiKey) delete dataToUpdate.transExpressApiKey;
    if (!dataToUpdate.royalExpressApiKey) delete dataToUpdate.royalExpressApiKey;

    await prisma.tenant.update({
      where: {
        id: session.user.tenantId, 
      },
      data: dataToUpdate,
    });

    revalidatePath('/settings');
    return { status: 'success' as const, message: 'Settings updated successfully.' };

  } catch (error) {
    console.error('Error updating tenant settings:', error);
    
    if (error instanceof z.ZodError) {
      return { status: 'error' as const, message: `Invalid data: ${error.errors.map(e => e.message).join(', ')}` };
    }

    const errorMessage = error instanceof Error ? error.message : 'An unknown database error occurred.';
    return { status: 'error' as const, message: `Failed to update settings: ${errorMessage}` };
  }
}

// --- NEW SERVER ACTION FOR PASSWORD CHANGE ---
export async function updateUserPassword(
  prevState: { message: string, status: 'error' | 'success' } | undefined,
  formData: FormData
): Promise<{ status: 'error' | 'success', message: string }> {
  const session = await getSession();

  if (!session?.user?.id) {
    return { status: 'error' as const, message: 'Unauthorized' };
  }

  try {
    const validatedData = passwordSchema.parse(Object.fromEntries(formData.entries()));
    const { password } = validatedData;
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return { status: 'success' as const, message: 'Password updated successfully.' };

  } catch (error) {
    if (error instanceof z.ZodError) {
      const formErrors = error.flatten().fieldErrors;
      const errorMessage = formErrors.password?.[0] ?? formErrors.confirmPassword?.[0] ?? "Invalid data provided.";
      return { status: 'error' as const, message: errorMessage };
    }
    return { status: 'error' as const, message: 'An unexpected error occurred.' };
  }
}