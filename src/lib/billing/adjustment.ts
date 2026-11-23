// src/lib/billing/adjustment.ts
//
// Reading a super admin's manual credit adjustment off the form.
//
// The direction is an explicit choice rather than the sign of the number. A
// single signed field meant a reduction typed without its minus sign — or on a
// keypad that has none — silently added the credits instead of taking them.

import { roundCredits } from './credit-price';

export type AdjustmentDirection = 'add' | 'remove';

export function parseCreditAdjustment(input: {
  direction: unknown;
  credits: unknown;
}): { direction: AdjustmentDirection; amount: number; signedCredits: number } {
  const direction = String(input.direction ?? '');
  if (direction !== 'add' && direction !== 'remove') {
    throw new Error('Choose whether to add or remove credits.');
  }

  const raw = String(input.credits ?? '').trim();
  const amount = raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a number of credits greater than zero.');
  }

  const rounded = roundCredits(amount);
  if (rounded <= 0) {
    throw new Error('Enter a number of credits greater than zero.');
  }

  return { direction, amount: rounded, signedCredits: direction === 'remove' ? -rounded : rounded };
}
