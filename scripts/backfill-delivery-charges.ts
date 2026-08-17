/**
 * Backfills platform fee charges for orders that were already DELIVERED before
 * billing was switched on.
 *
 * Dry run by default — nothing is written until you pass --commit.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-delivery-charges.ts
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-delivery-charges.ts --from 2026-08-01 --commit
 *
 * Options:
 *   --from <YYYY-MM-DD>  Only bill deliveries on or after this date. Defaults to
 *                        each tenant's first rate start, which is usually what
 *                        you want: a rate that starts today means nothing
 *                        historic is billable, and no tenant gets a surprise
 *                        invoice for months they were never told about.
 *   --tenant <id>        Restrict to one tenant.
 *   --commit             Actually write the charges.
 */

import { PrismaClient, OrderStatus } from '@prisma/client';
import { accrueDeliveryCharge } from '../src/lib/billing/charges';

const prisma = new PrismaClient();

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const commit = process.argv.includes('--commit');
  const fromRaw = argValue('--from');
  const tenantFilter = argValue('--tenant');

  const from = fromRaw ? new Date(fromRaw) : undefined;
  if (fromRaw && Number.isNaN(from!.getTime())) {
    throw new Error(`--from is not a valid date: ${fromRaw}`);
  }

  const orders = await prisma.order.findMany({
    where: {
      status: OrderStatus.DELIVERED,
      deliveredAt: { not: null, ...(from ? { gte: from } : {}) },
      deliveryCharge: null,
      ...(tenantFilter ? { tenantId: tenantFilter } : {}),
    },
    select: { id: true, tenantId: true, total: true, deliveredAt: true, number: true },
    orderBy: { deliveredAt: 'asc' },
  });

  console.log(`${commit ? 'Backfilling' : 'Dry run for'} ${orders.length} delivered orders without a charge.`);

  const perTenant = new Map<string, { billed: number; skipped: number; total: number }>();

  for (const order of orders) {
    const bucket = perTenant.get(order.tenantId) ?? { billed: 0, skipped: 0, total: 0 };

    // Runs through the same accrual path as a live delivery, inside its own
    // transaction, so the backfill can never produce a charge the normal flow
    // would not have produced. A dry run deliberately rolls each one back —
    // which means that under a TIERED_BY_VOLUME rate the preview prices every
    // order at tier 1. Committed totals are correct; dry-run totals for tiered
    // tenants are a floor, not an estimate.
    const result = await prisma.$transaction(async (tx) => {
      const accrual = await accrueDeliveryCharge(tx, {
        tenantId: order.tenantId,
        orderId: order.id,
        orderTotal: order.total,
        deliveredAt: order.deliveredAt!,
      });
      if (!commit) throw Object.assign(new Error('dry-run'), { accrual });
      return accrual;
    }).catch((error) => {
      if (error?.message === 'dry-run') return error.accrual;
      throw error;
    });

    if (result.billed) {
      bucket.billed += 1;
      bucket.total += result.amount;
    } else {
      bucket.skipped += 1;
    }
    perTenant.set(order.tenantId, bucket);
  }

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: [...perTenant.keys()] } },
    select: { id: true, name: true, businessName: true },
  });
  const names = new Map(tenants.map((tenant) => [tenant.id, tenant.businessName || tenant.name]));

  console.log('\nTenant                          Billed   Skipped        Total');
  console.log('-------------------------------------------------------------');
  for (const [tenantId, bucket] of perTenant) {
    const name = (names.get(tenantId) ?? tenantId).slice(0, 28).padEnd(30);
    console.log(
      `${name}${String(bucket.billed).padStart(6)}${String(bucket.skipped).padStart(10)}${bucket.total.toFixed(2).padStart(13)}`,
    );
  }

  if (!commit) {
    console.log('\nDry run — nothing was written. Re-run with --commit to apply.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
