import { Prisma } from '@prisma/client';

// Letters and digits only, so the code stays readable on labels and the
// prefix can be matched safely when checking for already-used numbers.
export const ORDER_CODE_PREFIX_PATTERN = /^[A-Z0-9]{1,10}$/;

export function formatOrderCode(prefix: string, sequence: number): string {
  return `${prefix}-${sequence}`;
}

/**
 * Claims the tenant's next order code (e.g. "DC-1622") inside the order's
 * transaction. The tenant row update locks it, so concurrent orders never get
 * the same number. Returns null when the tenant has no prefix configured.
 */
export async function claimOrderCode(tx: Prisma.TransactionClient, tenantId: string): Promise<string | null> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { orderCodePrefix: true } });
  if (!tenant?.orderCodePrefix) return null;

  const updated = await tx.tenant.update({
    where: { id: tenantId },
    data: { orderCodeNextNumber: { increment: 1 } },
    select: { orderCodePrefix: true, orderCodeNextNumber: true },
  });
  return formatOrderCode(updated.orderCodePrefix!, updated.orderCodeNextNumber - 1);
}

/** Highest sequence already used with this prefix, so the counter is never set behind it. */
export async function highestUsedOrderCode(
  client: Prisma.TransactionClient,
  tenantId: string,
  prefix: string,
): Promise<number> {
  const rows = await client.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(CAST(substring("orderCode" FROM CAST(${prefix.length + 2} AS INTEGER)) AS INTEGER)) AS max
    FROM "Order"
    WHERE "tenantId" = ${tenantId} AND "orderCode" ~ ${`^${prefix}-[0-9]+$`}
  `;
  return Number(rows[0]?.max ?? 0);
}

