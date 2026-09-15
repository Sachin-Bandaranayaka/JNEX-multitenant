import { z } from 'zod';
export const orderPricingSchema = z.object({
  productId: z.string().uuid(), quantity: z.number().int().min(1).max(100000),
  unitPrice: z.number().finite().min(0).max(1000000), discount: z.number().finite().min(0).max(100000000),
  deliveryFee: z.number().finite().min(0).max(1000000), prepaidAmount: z.number().finite().min(0).max(100000000),
}).superRefine((value, ctx) => {
  const subtotal = Math.round(value.unitPrice * 100) * value.quantity;
  if (Math.round(value.discount * 100) > subtotal) ctx.addIssue({ code: 'custom', message: 'Discount exceeds the product subtotal.' });
  if (Math.round(value.prepaidAmount * 100) > subtotal - Math.round(value.discount * 100) + Math.round(value.deliveryFee * 100)) ctx.addIssue({ code: 'custom', message: 'Prepaid amount exceeds the order total.' });
});
export function calculateOrderPricing(raw: unknown) {
  const input = orderPricingSchema.parse(raw);
  const unitPrice = Math.round(input.unitPrice * 100) / 100;
  const discount = Math.round(input.discount * 100) / 100;
  const deliveryFee = Math.round(input.deliveryFee * 100) / 100;
  const prepaidAmount = Math.round(input.prepaidAmount * 100) / 100;
  const totalCents = Math.round(unitPrice * 100) * input.quantity - Math.round(discount * 100) + Math.round(deliveryFee * 100);
  return { ...input, unitPrice, discount, deliveryFee, prepaidAmount, total: totalCents / 100, codAmount: (totalCents - Math.round(prepaidAmount * 100)) / 100 };
}
