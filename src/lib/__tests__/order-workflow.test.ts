import { describe, expect, it } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { canTransition } from '@/lib/order-workflow';

describe('order workflow transitions', () => {
  it('allows the normal fulfillment path', () => {
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.RETURNED)).toBe(true);
  });
  it('blocks terminal and duplicate transitions', () => {
    expect(canTransition(OrderStatus.RETURNED, OrderStatus.RETURNED)).toBe(false);
    expect(canTransition(OrderStatus.CANCELLED, OrderStatus.CONFIRMED)).toBe(false);
    expect(canTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
  });
});
