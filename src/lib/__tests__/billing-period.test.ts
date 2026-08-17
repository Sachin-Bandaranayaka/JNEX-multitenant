import { describe, expect, it } from 'vitest';
import { formatPeriod, periodBounds, periodKeyFor, previousPeriodKey } from '@/lib/billing/period';

// Sri Lanka is UTC+5:30 with no DST, so local midnight on the 1st is 18:30 UTC
// on the last day of the previous month. Charges landing in that 5.5-hour gap
// are the ones a naive UTC implementation puts on the wrong invoice.
describe('billing periods in Asia/Colombo', () => {
  it('assigns a delivery to the local calendar month', () => {
    expect(periodKeyFor(new Date('2026-08-15T09:00:00Z'))).toBe('2026-08');
  });

  it('puts a late-UTC delivery into the next local month', () => {
    // 31 Aug 19:00 UTC is already 1 Sep 00:30 in Colombo.
    expect(periodKeyFor(new Date('2026-08-31T19:00:00Z'))).toBe('2026-09');
  });

  it('keeps an early-UTC delivery in the previous local month', () => {
    // 1 Sep 02:00 UTC is 1 Sep 07:30 in Colombo — still September.
    expect(periodKeyFor(new Date('2026-09-01T02:00:00Z'))).toBe('2026-09');
    // 31 Aug 17:00 UTC is 31 Aug 22:30 in Colombo — still August.
    expect(periodKeyFor(new Date('2026-08-31T17:00:00Z'))).toBe('2026-08');
  });

  it('produces bounds that start and end at local midnight', () => {
    const { start, end } = periodBounds('2026-08');
    expect(start.toISOString()).toBe('2026-07-31T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-08-31T18:30:00.000Z');
  });

  it('rolls the year over correctly', () => {
    const { start, end } = periodBounds('2026-12');
    expect(start.toISOString()).toBe('2026-11-30T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-12-31T18:30:00.000Z');
    expect(previousPeriodKey('2026-01')).toBe('2025-12');
  });

  it('every instant in a month falls inside that month\'s bounds', () => {
    const { start, end } = periodBounds('2026-08');
    for (const instant of [start, new Date(start.getTime() + 1), new Date(end.getTime() - 1)]) {
      expect(periodKeyFor(instant)).toBe('2026-08');
    }
    expect(periodKeyFor(end)).toBe('2026-09');
  });

  it('rejects malformed period keys', () => {
    expect(() => periodBounds('2026-13')).toThrow();
    expect(() => periodBounds('August')).toThrow();
  });

  it('formats a period for humans', () => {
    expect(formatPeriod('2026-08')).toBe('August 2026');
  });
});
