import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), tenant: vi.fn(), wallet: vi.fn(), price: vi.fn(), topups: vi.fn(),
  ledger: vi.fn(), rate: vi.fn(), aggregate: vi.fn(), count: vi.fn(), charges: vi.fn(), invoices: vi.fn(),
}));
vi.stubGlobal('React', React);
vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(path); } }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  tenant: { findUniqueOrThrow: mocks.tenant }, creditTransaction: { findMany: mocks.ledger },
  tenantFeeRate: { findFirst: mocks.rate },
  deliveryCharge: { aggregate: mocks.aggregate, count: mocks.count, findMany: mocks.charges },
  tenantInvoice: { findMany: mocks.invoices },
} }));
vi.mock('@/lib/billing/credits', () => ({ getWalletSummary: mocks.wallet }));
vi.mock('@/lib/billing/credit-price', () => ({ currentCreditPrice: mocks.price, formatCredits: String }));
vi.mock('@/lib/billing/topups', () => ({ listTopUps: mocks.topups, topUpReference: () => 'TOPUP' }));
vi.mock('@/lib/billing/invoicing', () => ({ invoiceReference: () => 'INV' }));
vi.mock('../top-up-form', () => ({ TopUpForm: () => null }));
vi.mock('../pay-invoice-form', () => ({ PayInvoiceForm: () => null }));
import BillingPage from '../page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { tenantId: 'tenant-a', role: 'ADMIN' } });
  mocks.tenant.mockResolvedValue({ billingMode: 'POSTPAID' });
  mocks.wallet.mockResolvedValue({ available: 10, held: 2, spendable: 10, shipmentsRemaining: null });
  mocks.price.mockResolvedValue(null); mocks.topups.mockResolvedValue([]);
  mocks.ledger.mockResolvedValue([]); mocks.rate.mockResolvedValue(null);
  mocks.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 });
  mocks.count.mockResolvedValue(0); mocks.charges.mockResolvedValue([]); mocks.invoices.mockResolvedValue([]);
});

describe('tenant billing history', () => {
  it('keeps all unpaid invoices separate from date and status filtered history', async () => {
    await BillingPage({ searchParams: Promise.resolve({ status: 'PAID', from: '2026-09-01', to: '2026-09-15', invoicePage: '2' }) });
    expect(mocks.invoices).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { tenantId: 'tenant-a', status: 'PAID', createdAt: {
        gte: new Date('2026-08-31T18:30:00Z'), lt: new Date('2026-09-15T18:30:00Z'),
      } }, skip: 12, take: 13,
    }));
    expect(mocks.invoices).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { tenantId: 'tenant-a', status: 'ISSUED' } }));
    expect(mocks.invoices.mock.calls[1][0]).not.toHaveProperty('take');
    expect(mocks.wallet).not.toHaveBeenCalled();
  });

  it('scopes and pages prepaid credit activity without requesting invalid enum values', async () => {
    mocks.tenant.mockResolvedValue({ billingMode: 'PREPAID' });
    await BillingPage({ searchParams: Promise.resolve({ activity: 'HOLD', creditPage: '3', from: '2026-02-30', status: 'DRAFT' }) });
    expect(mocks.ledger).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-a', createdAt: {}, type: 'HOLD' }, skip: 50, take: 26 }));
    expect(mocks.invoices.mock.calls[0][0].where.status).toEqual({ not: 'DRAFT' });
    expect(mocks.wallet).toHaveBeenCalledWith('tenant-a');
  });

  it('does not turn a failed wallet lookup into a zero balance', async () => {
    mocks.tenant.mockResolvedValue({ billingMode: 'PREPAID' });
    mocks.wallet.mockRejectedValue(new Error('offline'));
    const page = await BillingPage({ searchParams: Promise.resolve({}) });
    const serialized = JSON.stringify(page);
    expect(serialized).toContain('Your credit balance is temporarily unavailable');
    expect(serialized).not.toContain('Shipping is paused');
  });

  it('denies staff before any billing reads', async () => {
    mocks.session.mockResolvedValue({ user: { tenantId: 'tenant-a', role: 'STAFF' } });
    await expect(BillingPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('/unauthorized');
    expect(mocks.tenant).not.toHaveBeenCalled();
  });
});
