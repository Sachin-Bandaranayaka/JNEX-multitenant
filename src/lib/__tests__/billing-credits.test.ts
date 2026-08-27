// Ledger tests.
//
// These run against an in-memory stand-in for a Prisma transaction rather than
// a database, because what is worth pinning down here is the arithmetic and the
// idempotency, not Postgres. The stub implements only the handful of queries
// the wallet actually issues.

import { beforeEach, describe, expect, it } from 'vitest';
import { BillingMode, CreditTxType, FeeModel, Prisma } from '@prisma/client';
import {
  captureForDelivery,
  getCreditBalance,
  getHeldCredits,
  holdForShipment,
  InsufficientCreditError,
  postCreditTx,
  refundCapture,
  releaseHold,
  shipFloor,
} from '@/lib/billing/credits';

const TENANT = 'tenant-1';

interface Row {
  id: string;
  seq: number;
  tenantId: string;
  type: CreditTxType;
  credits: Prisma.Decimal;
  creditsAfter: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  currency: string;
  creditPriceId: string | null;
  idempotencyKey: string;
  orderId: string | null;
  chargeId: string | null;
  [key: string]: unknown;
}

function makeTx(options: {
  /** null models a tenant with no fee rate in force. */
  flatFee?: number | null;
  /** null models a tenant the credit price was never configured for. */
  unitPrice?: number | null;
  billingMode?: BillingMode;
  charge?: { id: string; amount: number; orderId: string } | null;
}) {
  const rows: Row[] = [];
  const charges = new Map<string, { id: string; amount: number; status: string; deliveredAt: Date }>();
  if (options.charge) {
    charges.set(options.charge.orderId, {
      id: options.charge.id,
      amount: options.charge.amount,
      status: 'ACCRUED',
      deliveredAt: new Date('2026-08-10T00:00:00Z'),
    });
  }

  const tx = {
    rows,
    charges,
    $executeRaw: async () => 1,
    tenant: {
      findUniqueOrThrow: async () => ({
        billingMode: options.billingMode ?? BillingMode.PREPAID,
        creditLimitCredits: new Prisma.Decimal(0),
        minimumShipCredits: null,
      }),
    },
    tenantFeeRate: {
      findFirst: async () =>
        options.flatFee == null
          ? null
          : {
              id: 'rate-1',
              feeModel: FeeModel.FLAT_PER_ORDER,
              flatAmount: new Prisma.Decimal(options.flatFee),
              percentRate: null,
              tiers: null,
              minFee: null,
              maxFee: null,
              currency: 'LKR',
            },
    },
    creditPrice: {
      findFirst: async () =>
        options.unitPrice == null
          ? null
          : { id: 'price-1', unitPrice: new Prisma.Decimal(options.unitPrice), currency: 'LKR' },
    },
    deliveryCharge: {
      count: async () => 0,
      findUnique: async ({ where }: { where: { orderId: string } }) => {
        const charge = charges.get(where.orderId);
        return charge ? { ...charge, orderId: where.orderId } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        for (const charge of charges.values()) {
          if (charge.id === where.id) charge.status = data.status;
        }
        return {};
      },
    },
    creditTransaction: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        rows.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
      findFirst: async ({ where }: { where: { tenantId: string } }) => {
        const scoped = rows.filter((row) => row.tenantId === where.tenantId);
        return scoped.length === 0 ? null : scoped[scoped.length - 1];
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `tx-${rows.length + 1}`, seq: rows.length + 1 } as Row;
        rows.push(row);
        return row;
      },
      groupBy: async ({ where }: { where: { tenantId: string; type: { in: CreditTxType[] } } }) => {
        const buckets = new Map<CreditTxType, number>();
        for (const row of rows) {
          if (row.tenantId !== where.tenantId) continue;
          if (!where.type.in.includes(row.type)) continue;
          buckets.set(row.type, (buckets.get(row.type) ?? 0) + Number(row.credits));
        }
        return [...buckets].map(([type, sum]) => ({ type, _sum: { credits: sum } }));
      },
    },
  };

  // The stub is structural, not a real PrismaClient, so the cast is the point.
  return tx as unknown as Prisma.TransactionClient & typeof tx;
}

async function fund(tx: ReturnType<typeof makeTx>, credits: number) {
  await postCreditTx(tx, {
    tenantId: TENANT,
    type: CreditTxType.TOPUP,
    credits,
    unitPrice: 75,
    idempotencyKey: `topup:${credits}:${Math.random()}`,
  });
}

describe('postCreditTx', () => {
  let tx: ReturnType<typeof makeTx>;
  beforeEach(() => {
    tx = makeTx({ flatFee: 75, unitPrice: 75 });
  });

  it('stamps a running balance that tracks the ledger', async () => {
    await fund(tx, 100);
    const second = await postCreditTx(tx, {
      tenantId: TENANT,
      type: CreditTxType.HOLD,
      credits: -1,
      unitPrice: 75,
      idempotencyKey: 'hold:order-1',
    });
    expect(second.balance).toBe(99);
    expect(await getCreditBalance(tx, TENANT)).toBe(99);
  });

  it('posts a repeated key once and reports the replay', async () => {
    await fund(tx, 100);
    const first = await postCreditTx(tx, {
      tenantId: TENANT,
      type: CreditTxType.HOLD,
      credits: -1,
      unitPrice: 75,
      idempotencyKey: 'hold:order-1',
    });
    const replay = await postCreditTx(tx, {
      tenantId: TENANT,
      type: CreditTxType.HOLD,
      credits: -1,
      unitPrice: 75,
      idempotencyKey: 'hold:order-1',
    });

    expect(first.posted).toBe(true);
    expect(replay.posted).toBe(false);
    expect(replay.balance).toBe(99);
    expect(await getCreditBalance(tx, TENANT)).toBe(99);
  });
});

describe('holdForShipment', () => {
  it('reserves the fee and reduces the available balance', async () => {
    const tx = makeTx({ flatFee: 75, unitPrice: 75 });
    await fund(tx, 100);

    const result = await holdForShipment(tx, {
      tenantId: TENANT,
      orderId: 'order-1',
      orderTotal: 3000,
      at: new Date(),
    });

    expect(result).toEqual({ held: true, credits: 1, balance: 99 });
    expect(await getHeldCredits(tx, TENANT)).toBe(1);
  });

  it('refuses to ship a tenant past their floor', async () => {
    const tx = makeTx({ flatFee: 75, unitPrice: 75 });
    // Exactly enough for one order, and one order already reserved.
    await fund(tx, 1);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });

    await expect(
      holdForShipment(tx, { tenantId: TENANT, orderId: 'order-2', orderTotal: 3000, at: new Date() }),
    ).rejects.toBeInstanceOf(InsufficientCreditError);

    // The refusal wrote nothing: the balance is untouched.
    expect(await getCreditBalance(tx, TENANT)).toBe(0);
  });

  it('reports the exact shortfall so the tenant knows what to buy', async () => {
    const tx = makeTx({ flatFee: 75, unitPrice: 75 });
    await expect(
      holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() }),
    ).rejects.toMatchObject({ available: 0, required: 1, shortfall: 1, status: 402 });
  });

  it('lets a courier-reported shipment through and goes negative', async () => {
    // A parcel already in transit is not a request we can decline.
    const tx = makeTx({ flatFee: 75, unitPrice: 75 });
    const result = await holdForShipment(tx, {
      tenantId: TENANT,
      orderId: 'order-1',
      orderTotal: 3000,
      at: new Date(),
      allowOverdraft: true,
    });

    expect(result).toEqual({ held: true, credits: 1, balance: -1 });
  });

  it('does nothing for a postpaid tenant', async () => {
    const tx = makeTx({ flatFee: 75, unitPrice: 75, billingMode: BillingMode.POSTPAID });
    const result = await holdForShipment(tx, {
      tenantId: TENANT,
      orderId: 'order-1',
      orderTotal: 3000,
      at: new Date(),
    });
    expect(result).toEqual({ held: false, reason: 'postpaid' });
  });

  it('lets an unpriced tenant ship rather than stranding them', async () => {
    // No fee rate means nothing is owed; no credit price means a fee exists but
    // cannot be expressed in credits. Neither is the tenant's fault, and both
    // are surfaced on the super admin console instead of blocking here.
    const noRate = makeTx({ flatFee: null, unitPrice: 75 });
    await expect(
      holdForShipment(noRate, { tenantId: TENANT, orderId: 'o', orderTotal: 3000, at: new Date() }),
    ).resolves.toEqual({ held: false, reason: 'no-rate' });

    const noPrice = makeTx({ flatFee: 75, unitPrice: null });
    await expect(
      holdForShipment(noPrice, { tenantId: TENANT, orderId: 'o', orderTotal: 3000, at: new Date() }),
    ).resolves.toEqual({ held: false, reason: 'no-credit-price' });
  });

  it('does not double-reserve when a shipment is re-recorded', async () => {
    const tx = makeTx({ flatFee: 75, unitPrice: 75 });
    await fund(tx, 100);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });
    const again = await holdForShipment(tx, {
      tenantId: TENANT,
      orderId: 'order-1',
      orderTotal: 3000,
      at: new Date(),
    });

    expect(again).toEqual({ held: false, reason: 'already-held' });
    expect(await getCreditBalance(tx, TENANT)).toBe(99);
  });
});

describe('releasing and capturing', () => {
  it('returns a hold in full when the order never delivers', async () => {
    const tx = makeTx({ flatFee: 75, unitPrice: 75 });
    await fund(tx, 100);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });

    await releaseHold(tx, { orderId: 'order-1', reason: 'Returned' });

    expect(await getCreditBalance(tx, TENANT)).toBe(100);
    expect(await getHeldCredits(tx, TENANT)).toBe(0);
  });

  it('is a no-op for an order that was never held', async () => {
    const tx = makeTx({ flatFee: 75, unitPrice: 75 });
    await fund(tx, 100);
    await expect(releaseHold(tx, { orderId: 'never-shipped', reason: 'Cancelled' })).resolves.toEqual({
      released: false,
      credits: 0,
    });
    expect(await getCreditBalance(tx, TENANT)).toBe(100);
  });

  it('turns a hold into a spend on delivery and clears the reservation', async () => {
    const tx = makeTx({
      flatFee: 75,
      unitPrice: 75,
      charge: { id: 'charge-1', orderId: 'order-1', amount: 75 },
    });
    await fund(tx, 100);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });

    const captured = await captureForDelivery(tx, {
      tenantId: TENANT,
      orderId: 'order-1',
      at: new Date(),
    });

    expect(captured).toEqual({ captured: true, credits: 1, balance: 99 });
    expect(await getHeldCredits(tx, TENANT)).toBe(0);
    // Settled from the wallet, so it must never also reach an invoice.
    expect(tx.charges.get('order-1')?.status).toBe('PAID');
  });

  it('settles the difference when the real fee beats the ship-time estimate', async () => {
    // The hold was priced at a 75 flat fee; the order actually delivered into a
    // tier costing 90. Releasing in full and capturing the truth means the
    // wallet ends up 1.2 credits down, not 1.
    const tx = makeTx({
      flatFee: 75,
      unitPrice: 75,
      charge: { id: 'charge-1', orderId: 'order-1', amount: 90 },
    });
    await fund(tx, 100);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });

    const captured = await captureForDelivery(tx, { tenantId: TENANT, orderId: 'order-1', at: new Date() });

    expect(captured).toEqual({ captured: true, credits: 1.2, balance: 98.8 });
  });

  it('captures once even if delivery is reported twice', async () => {
    const tx = makeTx({
      flatFee: 75,
      unitPrice: 75,
      charge: { id: 'charge-1', orderId: 'order-1', amount: 75 },
    });
    await fund(tx, 100);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });
    await captureForDelivery(tx, { tenantId: TENANT, orderId: 'order-1', at: new Date() });
    const again = await captureForDelivery(tx, { tenantId: TENANT, orderId: 'order-1', at: new Date() });

    expect(again).toEqual({ captured: false, reason: 'already-captured' });
    expect(await getCreditBalance(tx, TENANT)).toBe(99);
  });

  it('gives the credit back when a delivered order is returned', async () => {
    const tx = makeTx({
      flatFee: 75,
      unitPrice: 75,
      charge: { id: 'charge-1', orderId: 'order-1', amount: 75 },
    });
    await fund(tx, 100);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });
    await captureForDelivery(tx, { tenantId: TENANT, orderId: 'order-1', at: new Date() });

    await refundCapture(tx, { orderId: 'order-1', reason: 'Returned after delivery' });

    expect(await getCreditBalance(tx, TENANT)).toBe(100);
  });

  it('releases the hold when an order delivers with no fee owed', async () => {
    const tx = makeTx({ flatFee: 75, unitPrice: 75, charge: null });
    await fund(tx, 100);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });

    const captured = await captureForDelivery(tx, { tenantId: TENANT, orderId: 'order-1', at: new Date() });

    expect(captured).toEqual({ captured: false, reason: 'no-charge' });
    expect(await getCreditBalance(tx, TENANT)).toBe(100);
  });
});

describe('shipFloor', () => {
  it('is zero by default — no credit, no shipping', () => {
    expect(shipFloor({ minimumShipCredits: null, creditLimitCredits: new Prisma.Decimal(0) })).toBe(0);
  });

  it('lets an overdraft allowance take the tenant negative', () => {
    // How a long-standing postpaid tenant is moved across without hitting a
    // wall on their first day.
    expect(shipFloor({ minimumShipCredits: null, creditLimitCredits: new Prisma.Decimal(5000) })).toBe(-5000);
  });

  it('lets an explicit minimum override the overdraft', () => {
    expect(
      shipFloor({ minimumShipCredits: new Prisma.Decimal(10), creditLimitCredits: new Prisma.Decimal(5000) }),
    ).toBe(10);
  });
});

describe('switching billing mode mid-flight', () => {
  it('returns a hold when the tenant is moved back to monthly invoicing', async () => {
    // The order shipped while prepaid and delivers after the switch. The fee is
    // now the invoice's problem, so the reservation must not stay stranded.
    const tx = makeTx({
      flatFee: 75,
      unitPrice: 75,
      charge: { id: 'charge-1', orderId: 'order-1', amount: 75 },
    });
    await fund(tx, 100);
    await holdForShipment(tx, { tenantId: TENANT, orderId: 'order-1', orderTotal: 3000, at: new Date() });
    expect(await getCreditBalance(tx, TENANT)).toBe(99);

    const captured = await captureForDelivery(tx, {
      tenantId: TENANT,
      orderId: 'order-1',
      at: new Date(),
      billingMode: BillingMode.POSTPAID,
    });

    expect(captured).toEqual({ captured: false, reason: 'postpaid' });
    expect(await getCreditBalance(tx, TENANT)).toBe(100);
    expect(await getHeldCredits(tx, TENANT)).toBe(0);
  });
});
