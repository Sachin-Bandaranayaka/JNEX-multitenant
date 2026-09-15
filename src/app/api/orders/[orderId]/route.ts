import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { calculateOrderPricing, orderPricingSchema } from '@/lib/order-pricing';
import { requirePermission, requireTenantAdmin } from '@/lib/authz';

export const dynamic = 'force-dynamic';

class OrderEditConflict extends Error {}

const UpdatePendingOrderSchema = z.object({
  pricing: orderPricingSchema.optional(),
  assignedUserId: z.string().uuid().optional(),
  customerEmail: z.string().email().or(z.literal('')).optional(),
  customerCity: z.string().trim().optional(),
  customerName: z.string().trim().min(1, 'Customer name is required'),
  customerPhone: z.string().trim().min(1, 'Phone number is required'),
  customerSecondPhone: z.string().trim().optional().nullable(),
  customerAddress: z.string().trim().min(1, 'Address is required'),
  notes: z.string().trim().optional().nullable(),
  shippingLocation: z.object({
    provider: z.literal('TRANS_EXPRESS'),
    districtId: z.number().int().positive(),
    districtName: z.string().trim().min(1),
    cityId: z.number().int().positive(),
    cityName: z.string().trim().min(1),
  }).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const guard = await requirePermission('EDIT_ORDERS');
    if (!guard.ok) return guard.response;
    const session = guard.session;

    const { orderId } = await params;
    const data = UpdatePendingOrderSchema.parse(await request.json());
    const tenantId = session.user.tenantId;

    const [order, tenant] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, tenantId },
        include: { lead: { select: { id: true, csvData: true } } },
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { transExpressApiKey: true },
      }),
    ]);

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (!['PENDING', 'CONFIRMED'].includes(order.status) || order.shippedAt || order.trackingNumber) {
      return NextResponse.json({ error: 'Only pending or confirmed orders awaiting shipment can be edited.' }, { status: 409 });
    }
    if (tenant?.transExpressApiKey && !data.shippingLocation) {
      return NextResponse.json(
        { error: 'Select a Trans Express district and city before saving.' },
        { status: 400 }
      );
    }

    if (data.assignedUserId && data.assignedUserId !== order.userId) {
      const admin = await requireTenantAdmin();
      if (!admin.ok) return admin.response;
    }
    const pricing = data.pricing ? calculateOrderPricing(data.pricing) : undefined;
    const updated = await prisma.$transaction(async (tx) => {
      const update = await tx.order.updateMany({
        where: { id: order.id, tenantId, status: order.status, shippedAt: null, trackingNumber: null, updatedAt: order.updatedAt },
        data: {
          ...(pricing ?? {}),
          ...(data.assignedUserId ? { userId: data.assignedUserId } : {}),
          ...(data.customerEmail !== undefined ? { customerEmail: data.customerEmail || null } : {}),
          ...(data.customerCity !== undefined ? { customerCity: data.customerCity } : {}),
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerSecondPhone: data.customerSecondPhone || null,
          customerAddress: data.customerAddress,
          notes: data.notes || null,
          ...(data.shippingLocation ? {
            customerCity: data.shippingLocation.cityName,
            shippingLocationProvider: data.shippingLocation.provider,
            shippingDistrictId: data.shippingLocation.districtId,
            shippingDistrictName: data.shippingLocation.districtName,
            shippingCityId: data.shippingLocation.cityId,
            shippingCityName: data.shippingLocation.cityName,
          } : {}),
        },
      });
      if (update.count !== 1) {
        throw new OrderEditConflict('Order changed while it was being edited; refresh and try again.');
      }

      if (data.assignedUserId) {
        const staff = await tx.user.findFirst({ where: { id: data.assignedUserId, tenantId, isActive: true, role: { not: 'SUPER_ADMIN' } } });
        if (!staff) throw new OrderEditConflict('Assigned staff is unavailable.');
      }
      let editedProductCode: string | undefined;
      if (pricing) {
        const product = await tx.product.findFirst({ where: { id: pricing.productId, tenantId, isActive: true } });
        if (!product) throw new OrderEditConflict('Product is unavailable.');
        editedProductCode = product.code;
        const changes = order.productId === pricing.productId
          ? [{ id: pricing.productId, delta: order.quantity - pricing.quantity }]
          : [{ id: order.productId, delta: order.quantity }, { id: pricing.productId, delta: -pricing.quantity }];
        for (const change of changes.sort((a, b) => a.id.localeCompare(b.id))) {
          if (!change.delta) continue;
          const current = await tx.product.findFirst({ where: { id: change.id, tenantId } });
          if (!current || current.stock + change.delta < 0) throw new OrderEditConflict('Insufficient stock for this change.');
          const changed = await tx.product.updateMany({ where: { id: change.id, tenantId, stock: current.stock }, data: { stock: { increment: change.delta } } });
          if (changed.count !== 1) throw new OrderEditConflict('Stock changed. Refresh and try again.');
          await tx.stockAdjustment.create({ data: { tenantId, productId: change.id, userId: session.user.id, quantity: change.delta, previousStock: current.stock, newStock: current.stock + change.delta, reason: `Edited Order #${order.number}` } });
        }
      }

      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: session.user.id,
          action: 'ORDER_EDITED',
          entityType: 'Order',
          entityId: order.id,
          metadata: {
            orderNumber: order.number,
            pricingBefore: { productId: order.productId, quantity: order.quantity, unitPrice: order.unitPrice, total: order.total, discount: order.discount, deliveryFee: order.deliveryFee, prepaidAmount: order.prepaidAmount, codAmount: order.codAmount },
            pricingAfter: pricing ?? null,
            before: {
              customerName: order.customerName, customerPhone: order.customerPhone,
              customerSecondPhone: order.customerSecondPhone, customerAddress: order.customerAddress,
              userId: order.userId, customerEmail: order.customerEmail, notes: order.notes, shippingCityId: order.shippingCityId,
              shippingCityName: order.shippingCityName, shippingDistrictName: order.shippingDistrictName,
            },
            after: {
              customerName: data.customerName, customerPhone: data.customerPhone,
              customerSecondPhone: data.customerSecondPhone || null, customerAddress: data.customerAddress,
              userId: data.assignedUserId ?? order.userId, customerEmail: data.customerEmail ?? order.customerEmail, notes: data.notes || null, shippingCityId: data.shippingLocation?.cityId ?? order.shippingCityId,
              shippingCityName: data.shippingLocation?.cityName ?? order.shippingCityName,
              shippingDistrictName: data.shippingLocation?.districtName ?? order.shippingDistrictName,
            },
          },
        },
      });

      const leadCsvData = order.lead.csvData as Record<string, unknown>;
      await tx.lead.update({
        where: { id: order.lead.id },
        data: {
          ...(editedProductCode ? { productCode: editedProductCode } : {}),
          ...(data.assignedUserId ? { userId: data.assignedUserId } : {}),
          csvData: {
            ...leadCsvData,
            name: data.customerName,
            customer_name: data.customerName,
            phone: data.customerPhone,
            secondPhone: data.customerSecondPhone || '',
            second_phone: data.customerSecondPhone || '',
            address: data.customerAddress,
            ...(data.customerEmail !== undefined ? { email: data.customerEmail } : {}),
            ...(editedProductCode ? { product_code: editedProductCode } : {}),
            notes: data.notes || '',
            city: data.shippingLocation?.cityName ?? data.customerCity ?? order.customerCity,
          },
        },
      });

      if (data.assignedUserId) await tx.leadReminder.updateMany({ where: { tenantId, leadId: order.lead.id, status: 'PENDING' }, data: { assignedUserId: data.assignedUserId } });

      return tx.order.findFirstOrThrow({
        where: { id: order.id, tenantId },
        include: { product: true, lead: true, assignedTo: true },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof OrderEditConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || 'Invalid order data' }, { status: 400 });
    }
    console.error('Pending order update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update order' },
      { status: 500 }
    );
  }
}
