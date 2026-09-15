import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';
const mocks = vi.hoisted(() => ({ guard: vi.fn(), tenant: vi.fn(), wallet: vi.fn() }));
vi.mock('@/lib/authz', () => ({ requireTenantAdmin: mocks.guard }));
vi.mock('@/lib/prisma', () => ({ prisma: { tenant: { findUniqueOrThrow: mocks.tenant } } }));
vi.mock('@/lib/billing/credits', () => ({ getWalletSummary: mocks.wallet }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ ok: true, tenantId: 'tenant-a' });
  mocks.tenant.mockResolvedValue({ billingMode: 'PREPAID' });
});
describe('header billing summary', () => {
  it('returns only the current tenant credit summary', async () => {
    mocks.wallet.mockResolvedValue({ billingMode: 'PREPAID', available: 123.5, held: 10, spendable: 123.5, unitPrice: 99 });
    const response = await GET();
    expect(await response.json()).toEqual({ billingMode: 'PREPAID', available: 123.5, held: 10, spendable: 123.5 });
    expect(mocks.wallet).toHaveBeenCalledWith('tenant-a');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('does not invent prepaid balances for a postpaid tenant', async () => {
    mocks.tenant.mockResolvedValue({ billingMode: 'POSTPAID' });
    expect(await (await GET()).json()).toEqual({ billingMode: 'POSTPAID' });
    expect(mocks.wallet).not.toHaveBeenCalled();
  });
  it('does not present failed lookups as a zero credit balance', async () => {
    mocks.wallet.mockRejectedValue(new Error('database unavailable'));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('available');
  });
  it('rejects users who cannot access tenant billing', async () => {
    mocks.guard.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await GET()).status).toBe(403);
    expect(mocks.tenant).not.toHaveBeenCalled();
  });
});
