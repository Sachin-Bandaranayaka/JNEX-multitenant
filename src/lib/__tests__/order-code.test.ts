import { describe, expect, it, vi } from 'vitest';
import { claimOrderCode, formatOrderCode, ORDER_CODE_PREFIX_PATTERN } from '../order-code';

function txWith(tenant: { orderCodePrefix: string | null; orderCodeNextNumber: number }) {
  return {
    tenant: {
      findUnique: vi.fn().mockResolvedValue(tenant),
      update: vi.fn().mockImplementation(async () => ({ ...tenant, orderCodeNextNumber: tenant.orderCodeNextNumber + 1 })),
    },
  } as any;
}

describe('order codes', () => {
  it('claims the configured next number and advances the counter', async () => {
    const tx = txWith({ orderCodePrefix: 'DC', orderCodeNextNumber: 1628 });
    await expect(claimOrderCode(tx, 't1')).resolves.toBe('DC-1628');
    expect(tx.tenant.update).toHaveBeenCalledWith(expect.objectContaining({ data: { orderCodeNextNumber: { increment: 1 } } }));
  });

  it('leaves the counter alone when the tenant has no prefix', async () => {
    const tx = txWith({ orderCodePrefix: null, orderCodeNextNumber: 1 });
    await expect(claimOrderCode(tx, 't1')).resolves.toBeNull();
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('formats and validates prefixes', () => {
    expect(formatOrderCode('DC', 1622)).toBe('DC-1622');
    expect(ORDER_CODE_PREFIX_PATTERN.test('DC')).toBe(true);
    expect(ORDER_CODE_PREFIX_PATTERN.test('JNEX-Mn')).toBe(false);
  });
});
