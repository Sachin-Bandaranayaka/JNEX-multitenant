export type DeliveryDateRecord = { deliveredAt: Date | null; updatedAt: Date };

export function effectiveDeliveryDate(record: DeliveryDateRecord): Date {
  return record.deliveredAt ?? record.updatedAt;
}

export function sortByEffectiveDeliveryDate<T extends DeliveryDateRecord>(records: T[]): T[] {
  return [...records].sort((a, b) => effectiveDeliveryDate(b).getTime() - effectiveDeliveryDate(a).getTime());
}
