import { describe, expect, it } from 'vitest';
import { LeadSchema } from '../csv-parser';

const base = { customer_name: 'A', address: 'Colombo', product_code: 'P1' };
const parse = (phone: string, second_phone?: string) =>
  LeadSchema.parse({ ...base, phone, second_phone });

describe('lead CSV phone de-duplication', () => {
  it('drops a secondary number that repeats the primary', () => {
    expect(parse('0771234567', '0771234567')).toMatchObject({ phone: '0771234567', second_phone: '' });
  });
  it('treats differently formatted copies of the same number as duplicates', () => {
    expect(parse('+94 771234567', '771234567')).toMatchObject({ phone: '0771234567', second_phone: '' });
  });
  it('drops a repeat inside the primary column', () => {
    expect(parse('0771234567 / 0771234567')).toMatchObject({ phone: '0771234567', second_phone: '' });
  });
  it('keeps a genuinely different secondary number', () => {
    expect(parse('0771234567', '0712345678')).toMatchObject({ phone: '0771234567', second_phone: '0712345678' });
  });
  it('uses the second distinct number when the primary column holds a repeat and the secondary a new one', () => {
    expect(parse('0771234567, 0771234567', '0712345678')).toMatchObject({ second_phone: '0712345678' });
  });
  it('gives the same result when re-validated on the server', () => {
    const once = parse('0771234567', '0771234567');
    expect(LeadSchema.parse(once)).toMatchObject({ phone: '0771234567', second_phone: '' });
  });
});
