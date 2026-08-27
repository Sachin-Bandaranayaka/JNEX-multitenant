import { describe, expect, it } from 'vitest';
import {
  creditsToMoney,
  feeToCredits,
  formatCredits,
  roundCredits,
  validateCreditPrice,
} from '@/lib/billing/credit-price';

describe('feeToCredits', () => {
  it('makes one delivered order cost exactly one credit at parity', () => {
    // The setup the whole scheme is explained to tenants with: a LKR 75 fee and
    // a LKR 75 credit means "100 credits = 100 shipments" is literally true.
    expect(feeToCredits(75, 75)).toBe(1);
  });

  it('scales percentage-of-order fees without rounding them to whole credits', () => {
    expect(feeToCredits(78, 75)).toBe(1.04);
    expect(feeToCredits(112.5, 75)).toBe(1.5);
  });

  it('charges more credits when the fee rises but the credit price does not', () => {
    // This is the deliberate lever for re-pricing balances a tenant already
    // bought: raise the fee alone and banked credit buys fewer shipments.
    expect(feeToCredits(90, 75)).toBe(1.2);
  });

  it('keeps a credit worth one order when fee and price move together', () => {
    expect(feeToCredits(90, 90)).toBe(1);
  });

  it('treats a missing or negative fee as free rather than as a refund', () => {
    expect(feeToCredits(0, 75)).toBe(0);
    expect(feeToCredits(-10, 75)).toBe(0);
  });

  it('refuses to divide by a zero or negative credit price', () => {
    expect(() => feeToCredits(75, 0)).toThrow(/greater than zero/);
    expect(() => feeToCredits(75, -75)).toThrow(/greater than zero/);
  });
});

describe('roundCredits', () => {
  it('keeps four decimal places and rounds half up', () => {
    expect(roundCredits(1.00005)).toBe(1.0001);
    expect(roundCredits(1.000049)).toBe(1);
    expect(roundCredits(0.1 + 0.2)).toBe(0.3);
  });

  it('rejects values that would silently poison the ledger', () => {
    expect(() => roundCredits(Number.NaN)).toThrow();
    expect(() => roundCredits(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe('creditsToMoney', () => {
  it('quotes a purchase exactly', () => {
    expect(creditsToMoney(100, 75)).toBe(7500);
    expect(creditsToMoney(1.04, 75)).toBe(78);
  });

  it('round-trips a fee back to itself', () => {
    expect(creditsToMoney(feeToCredits(75, 75), 75)).toBe(75);
    expect(creditsToMoney(feeToCredits(112.5, 75), 75)).toBe(112.5);
  });
});

describe('validateCreditPrice', () => {
  it('accepts a normal price', () => {
    expect(validateCreditPrice({ unitPrice: 75, minimumPurchaseCredits: 100 })).toEqual([]);
  });

  it('rejects a free or negative credit', () => {
    expect(validateCreditPrice({ unitPrice: 0 })).toHaveLength(1);
    expect(validateCreditPrice({ unitPrice: -1 })).toHaveLength(1);
  });

  it('rejects a minimum purchase of nothing', () => {
    expect(validateCreditPrice({ unitPrice: 75, minimumPurchaseCredits: 0 })).toHaveLength(1);
  });
});

describe('formatCredits', () => {
  it('drops trailing zeros so whole credits read as whole numbers', () => {
    expect(formatCredits(1)).toBe('1');
    expect(formatCredits(1.25)).toBe('1.25');
    expect(formatCredits(1000)).toBe('1,000');
  });
});
