import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface AuditQuery { actor?: string; action?: string; from?: string; to?: string; page?: string }

function dayBoundary(value: string | undefined, nextDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = new Date(`${value}T00:00:00+05:30`);
  if (!Number.isFinite(date.getTime())) return;
  return nextDay ? new Date(date.getTime() + 86400000) : date;
}

export function auditWhere(tenantId: string, query: AuditQuery): Prisma.AuditEventWhereInput {
  if (!tenantId) throw new Error('Tenant is required');
  const from = dayBoundary(query.from);
  const to = dayBoundary(query.to, true);
  return {
    tenantId,
    ...(query.actor ? { actorId: query.actor } : {}),
    ...(query.action ? { action: query.action } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };
}

export async function getTenantAuditLog(tenantId: string, query: AuditQuery) {
  const where = auditWhere(tenantId, query);
  const pageSize = 50;
  const requestedPage = Number(query.page);
  const [total, actorEvents, actionEvents] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({ where: { tenantId }, distinct: ['actorId'], select: { actor: { select: { id: true, name: true } } } }),
    prisma.auditEvent.findMany({ where: { tenantId }, distinct: ['action'], select: { action: true } }),
  ]);
  const page = Math.min(Math.max(1, Math.ceil(total / pageSize)), Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const events = await prisma.auditEvent.findMany({
    where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize,
    select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, metadata: true, actor: { select: { id: true, name: true } } },
  });
  return { events, actors: actorEvents.map(event => event.actor), actions: actionEvents.map(event => event.action).sort(), total, page, pageSize };
}

const labels: Record<string, string> = {
  ORDER_EDITED: 'Edited order',
  LEADS_IMPORTED: 'Imported leads', ORDER_STATUS_CHANGED: 'Changed order status', ORDER_CREATED: 'Created order',
  LEADS_ASSIGNED: 'Assigned leads', LEADS_UNASSIGNED: 'Unassigned leads',
  STAFF_ACCOUNT_CREATED: 'Created staff account', STAFF_ACCOUNT_UPDATED: 'Updated staff account',
  STAFF_ACCOUNT_DEACTIVATED: 'Deactivated staff account', PASSWORD_RESET_COMPLETED: 'Reset password',
  TENANT_WORKSPACE_VIEWED: 'Viewed tenant workspace',
  IMPERSONATION_STARTED: 'Started read-only support access', IMPERSONATION_ENDED: 'Ended read-only support access',
};
const fields: Record<string, string> = {
  customerName: 'Customer name', customerPhone: 'Phone', customerSecondPhone: 'Second phone',
  customerAddress: 'Address', notes: 'Notes', status: 'Status', shippingProvider: 'Courier',
  trackingNumber: 'Tracking number', quantity: 'Quantity', discount: 'Discount', total: 'Total',
  unitPrice: 'Unit price', deliveryFee: 'Delivery fee', prepaidAmount: 'Prepaid amount', codAmount: 'COD amount', productId: 'Product', userId: 'Assigned staff', customerEmail: 'Email',
  shippingCityName: 'Delivery city', shippingDistrictName: 'Delivery district',
};
const object = (value: Prisma.JsonValue | undefined): Prisma.JsonObject => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const printable = (value: Prisma.JsonValue | undefined) => value == null || value === '' ? 'Not recorded' : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : 'Changed';

/** Only allowlisted fields reach the UI; metadata may contain operational or security details. */
export function auditEventSummary(event: { action: string; entityType: string | null; entityId: string | null; metadata: Prisma.JsonValue }) {
  const metadata = object(event.metadata);
  const before = { ...object(metadata.before), ...object(metadata.pricingBefore) };
  const after = { ...object(metadata.before), ...object(metadata.pricingBefore), ...object(metadata.after), ...object(metadata.pricingAfter) };
  const changes = Object.entries(fields)
    .filter(([key]) => key in after && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map(([key, field]) => ({ field, before: printable(before[key]), after: printable(after[key]) }));
  const number = typeof metadata.orderNumber === 'number' ? ` #${metadata.orderNumber}` : '';
  const title = `${labels[event.action] || event.action.toLowerCase().replace(/_/g, ' ')}${event.entityType === 'Order' ? number : ''}`;
  const detail = typeof metadata.leadCount === 'number' ? `${metadata.leadCount} lead(s)` : null;
  const href = event.entityId && event.entityType === 'Order' ? `/orders/${encodeURIComponent(event.entityId)}`
    : event.entityId && event.entityType === 'Lead' ? `/leads/${encodeURIComponent(event.entityId)}`
    : event.entityType === 'User' ? '/users' : null;
  return { title, detail, href, changes };
}
