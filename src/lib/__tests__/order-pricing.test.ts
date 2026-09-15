import { describe, expect, it } from 'vitest';
import { calculateOrderPricing } from '../order-pricing';
const base = { productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', quantity: 3, unitPrice: 100.1, discount: 20.2, deliveryFee: 50, prepaidAmount: 100 };
describe('order pricing snapshots', () => {
  it('calculates total and COD in cents without floating-point drift', () => {
    expect(calculateOrderPricing(base)).toMatchObject({ total: 330.1, codAmount: 230.1 });
  });
  it('rejects discounts exceeding merchandise value', () => expect(() => calculateOrderPricing({ ...base, discount: 301 })).toThrow());
  it('rejects prepayments exceeding payable total', () => expect(() => calculateOrderPricing({ ...base, prepaidAmount: 400 })).toThrow());
  it('allows fully prepaid zero COD', () => expect(calculateOrderPricing({ ...base, prepaidAmount: 330.1 }).codAmount).toBe(0));
});
