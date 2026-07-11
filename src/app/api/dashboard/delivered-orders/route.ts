import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient } from '@/lib/prisma';
import { sortByEffectiveDeliveryDate } from '@/lib/effective-delivery-date';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('VIEW_DASHBOARD')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const prisma = getScopedPrismaClient(session.user.tenantId);

        // Include legacy delivered rows whose deliveredAt was never populated.
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const eligibleDeliveredOrders = await prisma.order.findMany({
            where: {
                status: 'DELIVERED',
                OR: [
                    { deliveredAt: { gte: thirtyDaysAgo } },
                    { deliveredAt: null, updatedAt: { gte: thirtyDaysAgo } },
                ],
            },
            include: {
                product: {
                    select: {
                        name: true,
                        code: true,
                    },
                },
                lead: {
                    select: {
                        csvData: true,
                    },
                },
            },
        });

        const deliveredOrders = sortByEffectiveDeliveryDate(eligibleDeliveredOrders).slice(0, 10);

        // Transform the data for the frontend
        const transformedOrders = deliveredOrders.map(order => {
            // Extract customer data from lead's csvData if available
            const leadData = order.lead?.csvData as any;

            return {
                id: order.id,
                orderNumber: order.number,
                customerName: order.customerName || leadData?.name || leadData?.customerName || 'Unknown Customer',
                customerPhone: order.customerPhone || leadData?.phone || leadData?.customerPhone || '',
                customerCity: order.customerCity || leadData?.city || leadData?.customerCity || '',
                total: order.total,
                deliveredAt: order.deliveredAt ?? order.updatedAt,
                trackingNumber: order.trackingNumber,
                shippingProvider: order.shippingProvider,
                productName: order.product?.name || 'Unknown Product',
                productCode: order.product?.code || '',
                quantity: order.quantity,
                status: order.status,
            };
        });

        // Calculate summary stats
        const totalDeliveredOrders = deliveredOrders.length;
        const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
        const averageOrderValue = totalDeliveredOrders > 0 ? totalRevenue / totalDeliveredOrders : 0;

        return NextResponse.json({
            orders: transformedOrders,
            summary: {
                totalDeliveredOrders,
                totalRevenue,
                averageOrderValue,
            },
        });

    } catch (error) {
        console.error('Error fetching delivered orders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch delivered orders' },
            { status: 500 }
        );
    }
}
