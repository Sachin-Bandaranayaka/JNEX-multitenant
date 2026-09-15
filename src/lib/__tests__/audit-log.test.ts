import { describe, expect, it } from 'vitest';
import { auditEventSummary, auditWhere } from '../audit-log';

describe('tenant audit log', () => {
  it('always applies tenant scope and interprets inclusive date filters in Sri Lanka time', () => {
    expect(auditWhere('tenant-a', { actor: 'user-a', action: 'ORDER_EDITED', from: '2026-09-14', to: '2026-09-14' })).toEqual({
      tenantId: 'tenant-a', actorId: 'user-a', action: 'ORDER_EDITED',
      createdAt: { gte: new Date('2026-09-13T18:30:00Z'), lt: new Date('2026-09-14T18:30:00Z') },
    });
    expect(() => auditWhere('', {})).toThrow('Tenant is required');
  });
  it('omits secrets and unchanged fields from summaries', () => {
    const result = auditEventSummary({ action: 'ORDER_EDITED', entityType: 'Order', entityId: 'order-a', metadata: {
      orderNumber: 269,
      before: { customerPhone: 'before', customerName: 'same', password: 'secret-before' },
      after: { customerPhone: 'after', customerName: 'same', password: 'secret-after' },
      apiKey: 'secret',
    } });
    expect(result).toEqual({ title: 'Edited order #269', href: '/orders/order-a', detail: null,
      changes: [{ field: 'Phone', before: 'before', after: 'after' }],
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('handles historical events without before/after metadata', () => {
    expect(auditEventSummary({ action: 'LEADS_ASSIGNED', entityType: 'Lead', entityId: null, metadata: { leadCount: 20 } })).toMatchObject({
      title: 'Assigned leads', detail: '20 lead(s)', href: null, changes: [],
    });
  });
});
