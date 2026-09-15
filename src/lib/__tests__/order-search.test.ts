import { describe, expect, it } from 'vitest';
import { orderSearchConditions } from '../order-search';

describe('order reference search', () => {
  it('finds business numbers with optional hash and surrounding whitespace', () => {
    expect(orderSearchConditions(' #269 ')).toContainEqual({ number: 269 });
  });
  it('keeps phone and internal reference searches without invalid database integers', () => {
    for (const input of ['9469304684096', 'Jnex26040265836CXE', '1.5', '-1']) {
      expect(orderSearchConditions(input).some(condition => 'number' in condition)).toBe(false);
      expect(orderSearchConditions(input)).toContainEqual({ id: { contains: input, mode: 'insensitive' } });
    }
  });
  it('searches secondary contact numbers too', () => {
    expect(orderSearchConditions('0712345678')).toContainEqual({
      customerSecondPhone: { contains: '0712345678', mode: 'insensitive' },
    });
  });
});
