// src/lib/billing/compute-fee.ts
//
// The single source of truth for "what does this delivered order cost the
// tenant". The accrual path, the backfill script, the superadmin rate preview
// and the invoice all call this — if they each did their own arithmetic they
// would eventually disagree, and disagreeing with an invoice you already sent
// is an expensive conversation.
//
// Pure and dependency-free on purpose, so it is cheap to unit test.

export type FeeModelName = 'FLAT_PER_ORDER' | 'PERCENT_OF_ORDER' | 'TIERED_BY_VOLUME';

export interface FeeTier {
  /** Inclusive upper bound on the tenant's delivered-order count in the month. `null` = the final, open-ended tier. */
  upTo: number | null;
  /** Fee per delivered order while inside this tier. */
  amount: number;
}

export interface FeeRateInput {
  feeModel: FeeModelName;
  flatAmount?: number | null;
  percentRate?: number | null;
  tiers?: FeeTier[] | null;
  minFee?: number | null;
  maxFee?: number | null;
}

export interface ComputeFeeInput {
  rate: FeeRateInput;
  /** The order's own total value (used by PERCENT_OF_ORDER). */
  orderTotal: number;
  /** 1-based position of this delivery within the tenant's billing month. */
  periodSequence: number;
}

/** Round half-up to 2 decimal places. Amounts here are always non-negative. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Cannot round a non-finite amount');
  // Scale-then-round in integer cents; the epsilon nudge keeps values like
  // 1.005 (stored as 1.00499...) rounding the way a human expects.
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Normalises tiers into ascending order with the open-ended tier last. */
export function normalizeTiers(tiers: FeeTier[]): FeeTier[] {
  return [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });
}

/**
 * Validates a rate definition. Returns a list of human-readable problems;
 * empty means the rate is usable. Called before persisting a rate so a
 * misconfiguration is caught at the form, not at 3am inside the delivery cron.
 */
export function validateRate(rate: FeeRateInput): string[] {
  const problems: string[] = [];

  switch (rate.feeModel) {
    case 'FLAT_PER_ORDER':
      if (rate.flatAmount == null) problems.push('A flat fee amount is required.');
      else if (rate.flatAmount < 0) problems.push('The flat fee cannot be negative.');
      break;

    case 'PERCENT_OF_ORDER':
      if (rate.percentRate == null) problems.push('A percentage rate is required.');
      else if (rate.percentRate < 0) problems.push('The percentage rate cannot be negative.');
      else if (rate.percentRate > 1) problems.push('The percentage rate is a fraction — use 0.025 for 2.5%.');
      break;

    case 'TIERED_BY_VOLUME': {
      const tiers = rate.tiers ?? [];
      if (tiers.length === 0) {
        problems.push('At least one volume tier is required.');
        break;
      }
      if (tiers.some((tier) => tier.amount == null || tier.amount < 0)) {
        problems.push('Every tier needs a fee amount of zero or more.');
      }
      if (tiers.some((tier) => tier.upTo !== null && tier.upTo < 1)) {
        problems.push('Tier bounds must be at least 1.');
      }
      if (tiers.filter((tier) => tier.upTo === null).length !== 1) {
        problems.push('Exactly one tier must be open-ended (leave its upper bound blank).');
      }
      const bounds = tiers.filter((tier) => tier.upTo !== null).map((tier) => tier.upTo as number);
      if (new Set(bounds).size !== bounds.length) {
        problems.push('Two tiers share the same upper bound.');
      }
      break;
    }

    default:
      problems.push(`Unknown fee model: ${String(rate.feeModel)}`);
  }

  if (rate.minFee != null && rate.minFee < 0) problems.push('The minimum fee cannot be negative.');
  if (rate.maxFee != null && rate.maxFee < 0) problems.push('The maximum fee cannot be negative.');
  if (rate.minFee != null && rate.maxFee != null && rate.minFee > rate.maxFee) {
    problems.push('The minimum fee is greater than the maximum fee.');
  }

  return problems;
}

/** The fee owed to the platform for one delivered order, in the rate's currency. */
export function computeFee({ rate, orderTotal, periodSequence }: ComputeFeeInput): number {
  const problems = validateRate(rate);
  if (problems.length > 0) {
    throw new Error(`Fee rate is not usable: ${problems.join(' ')}`);
  }
  if (!Number.isInteger(periodSequence) || periodSequence < 1) {
    throw new Error(`periodSequence must be a positive integer, got ${periodSequence}`);
  }

  let amount: number;

  switch (rate.feeModel) {
    case 'FLAT_PER_ORDER':
      amount = rate.flatAmount as number;
      break;

    case 'PERCENT_OF_ORDER':
      // A negative or absent order total is treated as zero rather than
      // producing a negative fee.
      amount = Math.max(0, orderTotal || 0) * (rate.percentRate as number);
      break;

    case 'TIERED_BY_VOLUME': {
      const tiers = normalizeTiers(rate.tiers as FeeTier[]);
      const tier = tiers.find((candidate) => candidate.upTo === null || periodSequence <= candidate.upTo);
      // validateRate guarantees an open-ended tier exists, so this always hits.
      amount = (tier as FeeTier).amount;
      break;
    }

    default:
      throw new Error(`Unknown fee model: ${String(rate.feeModel)}`);
  }

  if (rate.minFee != null) amount = Math.max(amount, rate.minFee);
  if (rate.maxFee != null) amount = Math.min(amount, rate.maxFee);

  return roundMoney(amount);
}

/** Coerces stored JSON tiers back into typed tiers, tolerating hand-edited rows. */
export function parseTiers(value: unknown): FeeTier[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const upTo = record.upTo == null ? null : Number(record.upTo);
    const amount = Number(record.amount);
    if (!Number.isFinite(amount)) return [];
    if (upTo !== null && !Number.isFinite(upTo)) return [];
    return [{ upTo, amount }];
  });
}
