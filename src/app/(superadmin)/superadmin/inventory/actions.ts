'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/superadmin-auth';

const receiptSchema = z.object({
  tenantId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive().max(100000),
  supplierName: z.string().trim().min(1).max(120),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function recordOwnSupplierStock(formData: FormData): Promise<void> {
  const { actor } = await requireSuperAdmin();

  const parsed = receiptSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((issue) => issue.message).join(' '));
  }
  const input = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'stock-control:' + input.productId}))`;

    const product = await tx.product.findFirst({
      where: { id: input.productId, tenantId: input.tenantId, isActive: true },
      select: { id: true, stock: true },
    });
    if (!product) throw new Error('The selected product does not belong to this tenant.');

    const updated = await tx.product.update({
      where: { id: product.id },
      data: { stock: { increment: input.quantity } },
      select: { stock: true },
    });

    const details = [
      `Own supplier: ${input.supplierName}`,
      input.reference ? `Reference: ${input.reference}` : null,
      input.note || null,
    ].filter(Boolean).join(' · ');

    await tx.stockAdjustment.create({
      data: {
        tenantId: input.tenantId,
        productId: product.id,
        userId: actor.id,
        quantity: input.quantity,
        previousStock: updated.stock - input.quantity,
        newStock: updated.stock,
        reason: details,
      },
    });
  });

  revalidatePath('/superadmin/inventory');
  revalidatePath('/inventory');
  revalidatePath('/products');
}
