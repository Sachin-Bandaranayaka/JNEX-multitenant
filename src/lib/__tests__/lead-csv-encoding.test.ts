import { describe, expect, it } from 'vitest';
import { decodeLeadCSV } from '../lead-csv-encoding';
const csv = 'customer_name,address\nසචිනි,කොළඹ';
const blob = (bytes: Uint8Array) => ({ arrayBuffer: async () => bytes.buffer }) as Blob;
describe('Unicode lead CSV decoding', () => {
  it('preserves Sinhala UTF-8 with and without a BOM', async () => {
    for (const prefix of ['', '\uFEFF']) {
      expect(await decodeLeadCSV(blob(new TextEncoder().encode(prefix + csv)))).toBe(csv);
    }
  });
  it('accepts BOM-marked UTF-16 in either byte order', async () => {
    for (const littleEndian of [true, false]) {
      const bytes = new Uint8Array((csv.length + 1) * 2);
      const view = new DataView(bytes.buffer);
      view.setUint16(0, 0xfeff, littleEndian);
      for (let i = 0; i < csv.length; i++) view.setUint16((i + 1) * 2, csv.charCodeAt(i), littleEndian);
      expect(await decodeLeadCSV(blob(bytes))).toBe(csv);
    }
  });
  it('rejects malformed data instead of silently replacing customer text', async () => {
    await expect(decodeLeadCSV(blob(new Uint8Array([0xff, 0x80])))).rejects.toThrow('CSV UTF-8');
  });
});
