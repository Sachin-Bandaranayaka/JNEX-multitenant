import type { Prisma } from '@prisma/client';

/** Match the human-facing order number as well as customer and courier references. */
export function orderSearchConditions(input: string): Prisma.OrderWhereInput[] {
  const query = input.trim();
  const numberText = query.replace(/^#/, '');
  const number = /^\d+$/.test(numberText) ? Number(numberText) : NaN;
  return [
    ...(Number.isSafeInteger(number) && number > 0 && number <= 2147483647 ? [{ number }] : []),
    { customerName: { contains: query, mode: 'insensitive' } },
    { customerPhone: { contains: query, mode: 'insensitive' } },
    { customerSecondPhone: { contains: query, mode: 'insensitive' } },
    { id: { contains: query, mode: 'insensitive' } },
    { trackingNumber: { contains: query, mode: 'insensitive' } },
  ];
}
