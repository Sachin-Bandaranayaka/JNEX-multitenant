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

const controlSchema = z.object({
  tenantId: z.string().uuid(),
  productId: z.string().uuid(),
  mode: z.enum(['ADD', 'REMOVE', 'SET']),
  quantity: z.coerce.number().int().min(0).max(1000000),
  reason: z.string().trim().min(3, 'Give a reason for this movement.').max(300),
});

const alertSchema = z.object({
  tenantId: z.string().uuid(),
  productId: z.string().uuid(),
  lowStockAlert: z.coerce.number().int().min(0).max(100000),
});

function revalidateStockViews() {
  revalidatePath('/superadmin/inventory');
  revalidatePath('/inventory');
  revalidatePath('/products');
}

/**
 * Applies a stock movement inside an advisory lock and writes the matching
 * StockAdjustment row. `delta` is signed; the caller has already resolved
 * absolute "set" requests into a delta against the live stock value.
 */
async function applyStockMovement(input: {
  tenantId: string;
  productId: string;
  actorId: string;
  resolveDelta: (currentStock: number) => number;
  reason: string;
  allowInactiveProduct?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'stock-control:' + input.productId}))`;

    const product = await tx.product.findFirst({
      where: {
        id: input.productId,
        tenantId: input.tenantId,
        ...(input.allowInactiveProduct ? {} : { isActive: true }),
      },
      select: { id: true, stock: true },
    });
    if (!product) throw new Error('The selected product does not belong to this tenant.');

    const delta = input.resolveDelta(product.stock);
    if (delta === 0) throw new Error('That would not change the stock level.');

    const newStock = product.stock + delta;
    if (newStock < 0) {
      throw new Error(`Only ${product.stock} unit(s) in stock — that movement would push it negative.`);
    }

    await tx.product.update({ where: { id: product.id }, data: { stock: newStock } });

    await tx.stockAdjustment.create({
      data: {
        tenantId: input.tenantId,
        productId: product.id,
        userId: input.actorId,
        quantity: delta,
        previousStock: product.stock,
        newStock,
        reason: input.reason,
      },
    });

    return { previousStock: product.stock, newStock, delta };
  });
}

export async function recordOwnSupplierStock(formData: FormData): Promise<void> {
  const { actor } = await requireSuperAdmin();

  const parsed = receiptSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((issue) => issue.message).join(' '));
  }
  const input = parsed.data;

  const details = [
    `Own supplier: ${input.supplierName}`,
    input.reference ? `Reference: ${input.reference}` : null,
    input.note || null,
  ].filter(Boolean).join(' · ');

  await applyStockMovement({
    tenantId: input.tenantId,
    productId: input.productId,
    actorId: actor.id,
    resolveDelta: () => input.quantity,
    reason: details,
  });

  revalidateStockViews();
}

/**
 * Full owner-level control over a tenant's stock: add units, remove units, or
 * set the on-hand figure to an exact number. Every mode lands in the same
 * StockAdjustment ledger so the movement stays auditable.
 */
export async function controlTenantStock(formData: FormData): Promise<{ previousStock: number; newStock: number }> {
  const { actor } = await requireSuperAdmin();

  const parsed = controlSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((issue) => issue.message).join(' '));
  }
  const input = parsed.data;

  if (input.mode !== 'SET' && input.quantity < 1) {
    throw new Error('Enter a quantity of at least 1.');
  }

  const label = { ADD: 'Owner stock in', REMOVE: 'Owner stock out', SET: 'Owner stock correction' }[input.mode];

  const result = await applyStockMovement({
    tenantId: input.tenantId,
    productId: input.productId,
    actorId: actor.id,
    allowInactiveProduct: true,
    resolveDelta: (currentStock) => {
      if (input.mode === 'ADD') return input.quantity;
      if (input.mode === 'REMOVE') return -input.quantity;
      return input.quantity - currentStock;
    },
    reason: input.mode === 'SET'
      ? `${label}: set to ${input.quantity} · ${input.reason}`
      : `${label}: ${input.reason}`,
  });

  revalidateStockViews();
  return { previousStock: result.previousStock, newStock: result.newStock };
}

/** Owner-side edit of a product's low-stock threshold. */
export async function setLowStockAlert(formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const parsed = alertSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    throw new Error(parsed.error.errors.map((issue) => issue.message).join(' '));
  }
  const input = parsed.data;

  const updated = await prisma.product.updateMany({
    where: { id: input.productId, tenantId: input.tenantId },
    data: { lowStockAlert: input.lowStockAlert },
  });
  if (updated.count === 0) throw new Error('The selected product does not belong to this tenant.');

  revalidateStockViews();
}
