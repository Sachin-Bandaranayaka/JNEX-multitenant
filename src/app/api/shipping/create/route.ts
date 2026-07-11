import { ShippingProviderFactory } from '@/lib/shipping/factory';
import { prisma, getScopedPrismaClient } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { OrderStatus, ShippingProvider } from '@prisma/client';
import type { ShippingAddress, PackageDetails } from '@/lib/shipping/types';
import { transitionOrder } from '@/lib/order-workflow';

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
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

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

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create shipment'
    }, { status: 500 });
  }
}
