// src/lib/billing/period.ts
//
// Billing periods are calendar months in the platform's own timezone, not UTC.
// A delivery at 02:00 Colombo time on the 1st belongs to the new month, even
// though it is still the previous month in UTC — getting this wrong shifts
// charges between invoices.

export const BILLING_TIME_ZONE = process.env.BILLING_TIME_ZONE || 'Asia/Colombo';

/** Offset in ms to add to a UTC instant to get the wall-clock time in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const at: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') at[part.type] = Number(part.value);
  }
  // Intl can report hour 24 for midnight in some engines.
  const hour = at.hour === 24 ? 0 : at.hour;
  const asIfUtc = Date.UTC(at.year, at.month - 1, at.day, hour, at.minute, at.second);
  return asIfUtc - instant.getTime();
}

/** Wall-clock calendar fields of `instant` in the billing timezone. */
export function zonedParts(instant: Date, timeZone: string = BILLING_TIME_ZONE) {
  const shifted = new Date(instant.getTime() + zoneOffsetMs(instant, timeZone));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** The billing month a delivery falls in, e.g. "2026-08". */
export function periodKeyFor(instant: Date, timeZone: string = BILLING_TIME_ZONE): string {
  const { year, month } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** The UTC instant of local midnight starting `year-month-01`. */
function zonedMonthStart(year: number, month: number, timeZone: string): Date {
  const naive = Date.UTC(year, month - 1, 1, 0, 0, 0);
  // Two passes converge even when the offset changes across the boundary.
  let guess = naive - zoneOffsetMs(new Date(naive), timeZone);
  guess = naive - zoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

export function parsePeriodKey(periodKey: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) throw new Error(`Invalid billing period key: ${periodKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid billing period key: ${periodKey}`);
  return { year, month };
}

/** Half-open range [start, end) covering the billing month, as UTC instants. */
export function periodBounds(periodKey: string, timeZone: string = BILLING_TIME_ZONE) {
  const { year, month } = parsePeriodKey(periodKey);
  const start = zonedMonthStart(year, month, timeZone);
  const end = month === 12
    ? zonedMonthStart(year + 1, 1, timeZone)
    : zonedMonthStart(year, month + 1, timeZone);
  return { start, end };
}

/** The billing month immediately before `periodKey`. */
export function previousPeriodKey(periodKey: string): string {
  const { year, month } = parsePeriodKey(periodKey);
  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, '0')}`;
}

/** Human label for a period key, e.g. "August 2026". */
export function formatPeriod(periodKey: string): string {
  const { year, month } = parsePeriodKey(periodKey);
  return `${new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${year}`;
}
