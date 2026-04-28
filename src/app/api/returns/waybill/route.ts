import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Look up an order by tracking number (waybill ID) and optionally mark as returned
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const prisma = getScopedPrismaClient(session.user.tenantId);
        const { searchParams } = new URL(request.url);
        const waybill = searchParams.get('waybill');

        if (!waybill) {
            return NextResponse.json({ error: 'Waybill number is required' }, { status: 400 });
        }

        const order = await prisma.order.findFirst({
            where: { trackingNumber: waybill },
            include: { product: true, assignedTo: true },
        });

        if (!order) {
            return NextResponse.json({ error: 'No order found with this waybill number' }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (error) {
        console.error('Error looking up waybill:', error);
        return NextResponse.json({ error: 'Failed to look up waybill' }, { status: 500 });
    }
}

// Mark an order as returned by waybill number
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const prisma = getScopedPrismaClient(session.user.tenantId);
        const { waybill } = await request.json();

        if (!waybill) {
            return NextResponse.json({ error: 'Waybill number is required' }, { status: 400 });
        }

        const order = await prisma.order.findFirst({
            where: { trackingNumber: waybill },
            include: { product: true },
        });

        if (!order) {
            return NextResponse.json({ error: 'No order found with this waybill number' }, { status: 404 });
        }

        if (order.status === 'RETURNED') {
            return NextResponse.json({ error: 'Order is already marked as returned' }, { status: 400 });
        }

        if (!['DELIVERED', 'SHIPPED'].includes(order.status)) {
            return NextResponse.json({ error: 'Only shipped or delivered orders can be returned' }, { status: 400 });
        }

        // Transaction: update order + restore stock
        const result = await prisma.$transaction(async (tx: any) => {
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: { status: 'RETURNED' },
                include: { product: true, assignedTo: true },
            });

            await tx.product.update({
                where: { id: order.product.id },
                data: { stock: { increment: order.quantity } },
            });

            await tx.stockAdjustment.create({
                data: {
                    quantity: order.quantity,
                    reason: `Return via waybill ${waybill}`,
                    previousStock: order.product.stock,
                    newStock: order.product.stock + order.quantity,
                    productId: order.product.id,
                    userId: session.user.id,
                    tenantId: session.user.tenantId,
                },
            });

            return updatedOrder;
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error processing waybill return:', error);
        return NextResponse.json({ error: 'Failed to process return' }, { status: 500 });
    }
}
