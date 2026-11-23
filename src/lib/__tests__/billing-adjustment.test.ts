import { describe, expect, it } from 'vitest';
import { parseCreditAdjustment } from '@/lib/billing/adjustment';

describe('parseCreditAdjustment', () => {
  it('turns a removal into a negative ledger amount', () => {
    expect(parseCreditAdjustment({ direction: 'remove', credits: '18' }).signedCredits).toBe(-18);
  });

  it('keeps an addition positive', () => {
    expect(parseCreditAdjustment({ direction: 'add', credits: '18' }).signedCredits).toBe(18);
  });

  it('never lets the sign of the typed number decide the direction', () => {
    // A minus sign typed into the amount used to be the only way to take
    // credit back. Now direction is explicit and a signed amount is refused.
    expect(() => parseCreditAdjustment({ direction: 'add', credits: '-18' })).toThrow(/greater than zero/);
    expect(() => parseCreditAdjustment({ direction: 'remove', credits: '-18' })).toThrow(/greater than zero/);
  });

  it('requires a direction', () => {
    expect(() => parseCreditAdjustment({ direction: null, credits: '5' })).toThrow(/add or remove/);
    expect(() => parseCreditAdjustment({ direction: 'subtract', credits: '5' })).toThrow(/add or remove/);
  });

  it('refuses empty, zero, and non-numeric amounts', () => {
    for (const credits of ['', '0', 'abc', null, '0.00001']) {
      expect(() => parseCreditAdjustment({ direction: 'remove', credits })).toThrow(/greater than zero/);
    }
  });

  it('keeps fractional credits to four places', () => {
    expect(parseCreditAdjustment({ direction: 'remove', credits: '1.25' }).signedCredits).toBe(-1.25);
  });
});
