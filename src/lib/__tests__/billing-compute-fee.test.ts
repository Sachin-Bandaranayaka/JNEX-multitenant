import { describe, expect, it } from 'vitest';
import { computeFee, normalizeTiers, parseTiers, roundMoney, validateRate } from '@/lib/billing/compute-fee';

describe('computeFee — flat per order', () => {
  const rate = { feeModel: 'FLAT_PER_ORDER' as const, flatAmount: 50 };

  it('charges the same fee regardless of order value or position', () => {
    expect(computeFee({ rate, orderTotal: 1500, periodSequence: 1 })).toBe(50);
    expect(computeFee({ rate, orderTotal: 90000, periodSequence: 812 })).toBe(50);
  });

  it('supports a zero fee for tenants on a free trial', () => {
    expect(computeFee({ rate: { ...rate, flatAmount: 0 }, orderTotal: 5000, periodSequence: 1 })).toBe(0);
  });
});

describe('computeFee — percentage of order', () => {
  const rate = { feeModel: 'PERCENT_OF_ORDER' as const, percentRate: 0.025 };

  it('takes the configured share of the order total', () => {
    expect(computeFee({ rate, orderTotal: 4000, periodSequence: 1 })).toBe(100);
  });

  it('rounds to two decimals rather than carrying float dust', () => {
    expect(computeFee({ rate, orderTotal: 3333.33, periodSequence: 1 })).toBe(83.33);
  });

  it('never produces a negative fee from bad order data', () => {
    expect(computeFee({ rate, orderTotal: -500, periodSequence: 1 })).toBe(0);
  });

  it('applies the floor and ceiling', () => {
    const capped = { ...rate, minFee: 25, maxFee: 500 };
    expect(computeFee({ rate: capped, orderTotal: 100, periodSequence: 1 })).toBe(25);
    expect(computeFee({ rate: capped, orderTotal: 1_000_000, periodSequence: 1 })).toBe(500);
  });
});

describe('computeFee — tiered by volume', () => {
  const rate = {
    feeModel: 'TIERED_BY_VOLUME' as const,
    tiers: [
      { upTo: 100, amount: 60 },
      { upTo: 500, amount: 50 },
      { upTo: null, amount: 40 },
    ],
  };

  it('prices each delivery by its position in the month', () => {
    expect(computeFee({ rate, orderTotal: 1000, periodSequence: 1 })).toBe(60);
    expect(computeFee({ rate, orderTotal: 1000, periodSequence: 100 })).toBe(60);
    expect(computeFee({ rate, orderTotal: 1000, periodSequence: 101 })).toBe(50);
    expect(computeFee({ rate, orderTotal: 1000, periodSequence: 500 })).toBe(50);
    expect(computeFee({ rate, orderTotal: 1000, periodSequence: 501 })).toBe(40);
    expect(computeFee({ rate, orderTotal: 1000, periodSequence: 99999 })).toBe(40);
  });

  it('does not care what order the tiers were entered in', () => {
    const shuffled = { ...rate, tiers: [rate.tiers[2], rate.tiers[1], rate.tiers[0]] };
    expect(computeFee({ rate: shuffled, orderTotal: 1000, periodSequence: 1 })).toBe(60);
    expect(computeFee({ rate: shuffled, orderTotal: 1000, periodSequence: 700 })).toBe(40);
  });

  it('rejects a sequence that is not a positive integer', () => {
    expect(() => computeFee({ rate, orderTotal: 1000, periodSequence: 0 })).toThrow();
  });
});

describe('validateRate', () => {
  it('accepts well-formed rates', () => {
    expect(validateRate({ feeModel: 'FLAT_PER_ORDER', flatAmount: 50 })).toEqual([]);
    expect(validateRate({ feeModel: 'PERCENT_OF_ORDER', percentRate: 0.03 })).toEqual([]);
  });

  it('catches a percentage entered as 2.5 instead of 0.025', () => {
    expect(validateRate({ feeModel: 'PERCENT_OF_ORDER', percentRate: 2.5 })).toHaveLength(1);
  });

  it('requires exactly one open-ended tier', () => {
    expect(validateRate({
      feeModel: 'TIERED_BY_VOLUME',
      tiers: [{ upTo: 100, amount: 50 }],
    })).toContain('Exactly one tier must be open-ended (leave its upper bound blank).');

    expect(validateRate({
      feeModel: 'TIERED_BY_VOLUME',
      tiers: [{ upTo: null, amount: 50 }, { upTo: null, amount: 40 }],
    })).toContain('Exactly one tier must be open-ended (leave its upper bound blank).');
  });

  it('rejects a floor above the ceiling', () => {
    expect(validateRate({ feeModel: 'FLAT_PER_ORDER', flatAmount: 50, minFee: 100, maxFee: 10 }))
      .toContain('The minimum fee is greater than the maximum fee.');
  });

  it('refuses to compute with an unusable rate', () => {
    expect(() => computeFee({
      rate: { feeModel: 'FLAT_PER_ORDER' },
      orderTotal: 1000,
      periodSequence: 1,
    })).toThrow(/not usable/);
  });
});

describe('helpers', () => {
  it('rounds half up', () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(2.344)).toBe(2.34);
    expect(roundMoney(2.345)).toBe(2.35);
  });

  it('puts the open-ended tier last', () => {
    const sorted = normalizeTiers([{ upTo: null, amount: 1 }, { upTo: 10, amount: 2 }]);
    expect(sorted.map((tier) => tier.upTo)).toEqual([10, null]);
  });

  it('drops junk when reading tiers back out of JSON', () => {
    expect(parseTiers([{ upTo: 10, amount: 5 }, { upTo: 'x', amount: 5 }, null, { amount: 'y' }]))
      .toEqual([{ upTo: 10, amount: 5 }]);
  });
});
