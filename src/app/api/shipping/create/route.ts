import { ShippingProviderFactory } from '@/lib/shipping/factory';
import { prisma, getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderStatus, ShippingProvider } from '@prisma/client';
import type { ShippingAddress, PackageDetails } from '@/lib/shipping/types';
import { transitionOrder } from '@/lib/order-workflow';
import { checkCanShip, InsufficientCreditError } from '@/lib/billing/credits';
import { requirePermission, requireAnyPermission } from '@/lib/authz';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Define Zod schemas that match our TypeScript interfaces
const AddressSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  phone: z.string().min(1, 'Phone is required'),
}) as z.ZodType<ShippingAddress>;

const PackageSchema = z.object({
  weight: z.number().positive('Weight must be positive'),
  length: z.number().positive('Length must be positive'),
  width: z.number().positive('Width must be positive'),
  height: z.number().positive('Height must be positive'),
}) as z.ZodType<PackageDetails>;

const CreateShipmentSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.nativeEnum(ShippingProvider),
  service: z.string(),
  origin: AddressSchema,
  destination: AddressSchema,
  packageDetails: PackageSchema,
});

export async function POST(request: Request) {
  try {
    // Booking a shipment moves an order forward; viewing shipping does not.
    const guard = await requireAnyPermission(['UPDATE_SHIPPING_STATUS', 'EDIT_ORDERS']);
    if (!guard.ok) return guard.response;
    const session = guard.session;

    const json = await request.json();
    const data = CreateShipmentSchema.parse(json);

    // Get the shipping provider
    const tenantId = session.user.tenantId;

    // The Tenant model itself is not tenant-scoped (it has no tenantId column),
    // so look it up by id with the raw client. Order writes below use a
    // tenant-scoped client to avoid cross-tenant shipment creation.
    const scopedPrisma = getScopedPrismaClient(tenantId);

    const order = await scopedPrisma.order.findFirst({ where: { id: data.orderId } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (!['PENDING', 'CONFIRMED', 'RESCHEDULED'].includes(order.status)) {
      return NextResponse.json({ error: `Order cannot be shipped from ${order.status}` }, { status: 409 });
    }

    // Checked before the courier is called, not after. The hold inside
    // transitionOrder is the binding one, but reaching it with an empty wallet
    // would mean a waybill was already bought for a shipment we then refuse.
    const credit = await checkCanShip(prisma, { tenantId, orderTotal: order.total });
    if (!credit.ok) {
      return NextResponse.json(
        {
          error: `Not enough credit to ship this order. It needs ${credit.required} credit(s) and ${credit.available} are available.`,
          code: 'INSUFFICIENT_CREDIT',
          available: credit.available,
          required: credit.required,
          shortfall: credit.shortfall,
        },
        { status: 402 },
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        fardaExpressClientId: true,
        fardaExpressApiKey: true,
        transExpressApiKey: true,
        royalExpressApiKey: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const shippingProviderFactory = new ShippingProviderFactory({
      fardaExpressClientId: tenant.fardaExpressClientId || undefined,
      fardaExpressApiKey: tenant.fardaExpressApiKey || undefined,
      transExpressApiKey: tenant.transExpressApiKey || undefined,
      royalExpressApiKey: tenant.royalExpressApiKey || undefined,
    });

    const provider = shippingProviderFactory.getProvider(data.provider);

    // Create the shipment
    const label = await provider.createShipment(
      data.origin,
      data.destination,
      data.packageDetails,
      data.service
    );

    // Update the order with shipping information (scoped: cross-tenant order
    // ids will not match and the update affects no rows).
    const updatedOrder = await transitionOrder({
      orderId: data.orderId,
      tenantId,
      userId: session.user.id,
      to: OrderStatus.SHIPPED,
      source: 'courier shipment creation',
      shipping: { provider: data.provider, trackingNumber: label.trackingNumber },
    });

    return NextResponse.json({
      order: updatedOrder,
      label,
    });
  } catch (error) {
    console.error('Create shipment error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors,
      }, { status: 400 });
    }

    // The pre-flight above normally catches this; reaching it here means the
    // balance moved between the check and the hold. The waybill exists but the
    // order was not moved, so it is safe to report and retry after a top-up.
    if (error instanceof InsufficientCreditError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'INSUFFICIENT_CREDIT',
          available: error.available,
          required: error.required,
          shortfall: error.shortfall,
        },
        { status: 402 },
      );
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create shipment'
    }, { status: 500 });
  }
}
