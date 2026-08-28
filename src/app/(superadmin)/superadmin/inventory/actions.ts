'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AuthorizationError, requireSuperAdmin } from '@/lib/superadmin-auth';

/**
 * Tenant ids are cuids (`@default(cuid())`), product ids are uuids. Validating
 * a tenant id as a uuid rejects every real tenant, so both are checked only for
 * shape here — ownership is what actually authorises the write, and that is
 * enforced against the database inside the transaction.
 */
const tenantId = z.string().trim().min(1, 'Select a tenant.').max(64);
const productId = z.string().trim().min(1, 'Select a product.').max(64);

/** What every action here hands back; `message` is safe to show the operator. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? {} : T))
  | { ok: false; message: string };

const receiptSchema = z.object({
  tenantId,
  productId,
  quantity: z.coerce.number().int().positive().max(100000),
  supplierName: z.string().trim().min(1).max(120),
  reference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
});

const controlSchema = z.object({
  tenantId,
  productId,
  mode: z.enum(['ADD', 'REMOVE', 'SET']),
  quantity: z.coerce.number().int().min(0).max(1000000),
  reason: z.string().trim().min(3, 'Give a reason for this movement.').max(300),
});

const alertSchema = z.object({
  tenantId,
  productId,
  lowStockAlert: z.coerce.number().int().min(0).max(100000),
});

function revalidateStockViews() {
  revalidatePath('/superadmin/inventory');
  revalidatePath('/inventory');
  revalidatePath('/products');
}

/** An error whose message is written for the operator and safe to show them. */
class StockControlError extends Error {}

/**
 * Next.js strips thrown server-action errors in production builds and hands the
 * client a bare digest, so a failure here would otherwise reach the operator as
 * "an error occurred". Every action returns its outcome instead: expected
 * problems carry their own message, and anything unexpected is logged server
 * side where the digest can be matched to it.
 */
function failure(scope: string, cause: unknown): { ok: false; message: string } {
  if (cause instanceof StockControlError || cause instanceof AuthorizationError) {
    return { ok: false, message: cause.message };
  }
  if (cause instanceof z.ZodError) {
    return { ok: false, message: cause.errors.map((issue) => issue.message).join(' ') };
  }
  console.error(`[superadmin/inventory] ${scope} failed`, cause);
  return { ok: false, message: 'The movement could not be saved. The server log has the details.' };
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
    if (!product) throw new StockControlError('The selected product does not belong to this tenant.');

    const delta = input.resolveDelta(product.stock);
    if (delta === 0) throw new StockControlError('That would not change the stock level.');

    const newStock = product.stock + delta;
    if (newStock < 0) {
      throw new StockControlError(`Only ${product.stock} unit(s) in stock — that movement would push it negative.`);
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

export async function recordOwnSupplierStock(formData: FormData): Promise<ActionResult> {
  try {
    const { actor } = await requireSuperAdmin();
    const input = receiptSchema.parse(Object.fromEntries(formData.entries()));

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
    return { ok: true };
  } catch (cause) {
    return failure('own-supplier receipt', cause);
  }
}

/**
 * Full owner-level control over a tenant's stock: add units, remove units, or
 * set the on-hand figure to an exact number. Every mode lands in the same
 * StockAdjustment ledger so the movement stays auditable.
 */
export async function controlTenantStock(
  formData: FormData,
): Promise<ActionResult<{ previousStock: number; newStock: number }>> {
  try {
    const { actor } = await requireSuperAdmin();
    const input = controlSchema.parse(Object.fromEntries(formData.entries()));

    if (input.mode !== 'SET' && input.quantity < 1) {
      throw new StockControlError('Enter a quantity of at least 1.');
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
    return { ok: true, previousStock: result.previousStock, newStock: result.newStock };
  } catch (cause) {
    return failure('stock control', cause);
  }
}

/** Owner-side edit of a product's low-stock threshold. */
export async function setLowStockAlert(formData: FormData): Promise<ActionResult> {
  try {
    await requireSuperAdmin();
    const input = alertSchema.parse(Object.fromEntries(formData.entries()));

    const updated = await prisma.product.updateMany({
      where: { id: input.productId, tenantId: input.tenantId },
      data: { lowStockAlert: input.lowStockAlert },
    });
    if (updated.count === 0) {
      throw new StockControlError('The selected product does not belong to this tenant.');
    }

    revalidateStockViews();
    return { ok: true };
  } catch (cause) {
    return failure('low-stock threshold', cause);
  }
}
