import { describe, expect, it } from 'vitest';
import { sortByEffectiveDeliveryDate } from '../effective-delivery-date';

describe('sortByEffectiveDeliveryDate', () => {
  it('orders current and legacy deliveries by the timestamp shown to operators', () => {
    const rows = [
      { id: 'current-old', deliveredAt: new Date('2026-07-08T10:00:00Z'), updatedAt: new Date('2026-07-10T10:00:00Z') },
      { id: 'legacy-new', deliveredAt: null, updatedAt: new Date('2026-07-11T10:00:00Z') },
      { id: 'current-new', deliveredAt: new Date('2026-07-12T10:00:00Z'), updatedAt: new Date('2026-07-12T11:00:00Z') },
    ];
    expect(sortByEffectiveDeliveryDate(rows).map(row => row.id)).toEqual(['current-new', 'legacy-new', 'current-old']);
  });
});
