import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const UpdatePendingOrderSchema = z.object({
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('EDIT_ORDERS')) {
      return NextResponse.json({ error: 'You do not have permission to edit orders.' }, { status: 403 });
    }

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
    if (order.status !== 'CONFIRMED') {
      return NextResponse.json({ error: 'Only confirmed orders awaiting shipment can be edited.' }, { status: 409 });
    }
    if (tenant?.transExpressApiKey && !data.shippingLocation) {
      return NextResponse.json(
        { error: 'Select a Trans Express district and city before saving.' },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const update = await tx.order.updateMany({
        where: { id: order.id, tenantId, status: 'CONFIRMED' },
        data: {
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
        throw new Error('Order changed while it was being edited; refresh and try again.');
      }

      const leadCsvData = order.lead.csvData as Record<string, unknown>;
      await tx.lead.update({
        where: { id: order.lead.id },
        data: {
          csvData: {
            ...leadCsvData,
            name: data.customerName,
            phone: data.customerPhone,
            secondPhone: data.customerSecondPhone || '',
            address: data.customerAddress,
            notes: data.notes || '',
            city: data.shippingLocation?.cityName || order.customerCity,
          },
        },
      });

      return tx.order.findFirstOrThrow({
        where: { id: order.id, tenantId },
        include: { product: true, lead: true, assignedTo: true },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
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
