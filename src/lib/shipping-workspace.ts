import { Prisma, ShippingProvider, OrderStatus } from '@prisma/client';
import { orderSearchConditions } from './order-search';

export type ShippingSection = 'ship' | 'shipped' | 'summary' | 'delivery';
export type ShippingFilters = { q?: string; courier?: string; staff?: string; status?: string; from?: string; to?: string; view?: string };
export function normalizeShippingFilters(section: ShippingSection, input: ShippingFilters): ShippingFilters {
  const filters = { ...input };
  const statuses: string[] = section === 'ship' ? ['PENDING', 'CONFIRMED'] : section === 'delivery' ? ['SHIPPED', 'DELIVERED', 'RETURNED', 'RESCHEDULED'] : ['SHIPPED', 'DELIVERED', 'RETURNED', 'RESCHEDULED', 'CANCELLED'];
  if (filters.status && !statuses.includes(filters.status)) delete filters.status;
  if (section === 'ship') {
    if (filters.courier === 'ROYAL_EXPRESS') delete filters.courier;
    delete filters.view;
  }
  return filters;
}
export function shippingWhere(tenantId: string, section: ShippingSection, input: ShippingFilters): Prisma.OrderWhereInput {
  const filters = normalizeShippingFilters(section, input);
  const conditions: Prisma.OrderWhereInput[] = [];
  if (section === 'ship') {
    conditions.push({ status: { in: ['PENDING', 'CONFIRMED'] }, shippedAt: null, trackingNumber: null });
  } else {
    conditions.push({ OR: [{ shippedAt: { not: null } }, { status: { in: ['SHIPPED', 'DELIVERED', 'RETURNED', 'RESCHEDULED'] } }] });
    if (section === 'delivery') conditions.push({ status: { in: ['SHIPPED', 'DELIVERED', 'RETURNED', 'RESCHEDULED'] } });
  }
  if (filters.q?.trim()) conditions.push({ OR: orderSearchConditions(filters.q) });
  if (filters.courier && Object.values(ShippingProvider).includes(filters.courier as ShippingProvider)) conditions.push({ shippingProvider: filters.courier as ShippingProvider });
  if (filters.staff) conditions.push({ userId: filters.staff });
  if (filters.status && Object.values(OrderStatus).includes(filters.status as OrderStatus)) conditions.push({ status: filters.status as OrderStatus });
  const date: Prisma.DateTimeNullableFilter = {};
  for (const key of ['from', 'to'] as const) {
    const value = filters[key];
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
    const calendarDate = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value) continue;
    const timestamp = new Date(`${value}T00:00:00+05:30`);
    if (!Number.isFinite(timestamp.getTime())) continue;
    if (key === 'from') date.gte = timestamp;
    else date.lt = new Date(timestamp.getTime() + 86400000);
  }
  if (Object.keys(date).length) conditions.push(section === 'ship' ? { createdAt: date as Prisma.DateTimeFilter } : { shippedAt: date });
  if (filters.view === 'exceptions') conditions.push({ trackingUpdates: { some: { isException: true } } });
  return { tenantId, AND: conditions };
}

export function summarizeShipments(orders: Array<{ status: string; shippingProvider: string | null; total: number; quantity: number }>) {
  const groups = new Map<string, { courier: string; orders: number; quantity: number; total: number; delivered: number; returned: number; inProgress: number; other: number }>();
  for (const order of orders) {
    const courier = order.shippingProvider ?? 'UNASSIGNED';
    const group = groups.get(courier) ?? { courier, orders: 0, quantity: 0, total: 0, delivered: 0, returned: 0, inProgress: 0, other: 0 };
    group.orders++; group.quantity += order.quantity; group.total += order.total;
    if (order.status === 'DELIVERED') group.delivered++;
    else if (order.status === 'RETURNED') group.returned++;
    else if (['SHIPPED', 'RESCHEDULED'].includes(order.status)) group.inProgress++;
    else group.other++;
    groups.set(courier, group);
  }
  return [...groups.values()].sort((a, b) => a.courier.localeCompare(b.courier));
}
