// src/app/api/reports/financial/route.ts

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getScopedPrismaClient } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
        }

        const prisma = getScopedPrismaClient(session.user.tenantId);

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // Get all orders in date range
        const orders = await prisma.order.findMany({
            where: {
                createdAt: { gte: start, lte: end },
            },
            include: {
                product: { select: { name: true, price: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Calculate metrics by status
        const deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
        const returnedOrders = orders.filter(o => o.status === OrderStatus.RETURNED);
        const shippedOrders = orders.filter(o => o.status === OrderStatus.SHIPPED);
        const pendingOrders = orders.filter(o => o.status === OrderStatus.PENDING || o.status === OrderStatus.CONFIRMED);
        const cancelledOrders = orders.filter(o => o.status === OrderStatus.CANCELLED);

        // Revenue calculations
        const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + o.total, 0);
        const returnedValue = returnedOrders.reduce((sum, o) => sum + o.total, 0);
        const pendingValue = shippedOrders.reduce((sum, o) => sum + o.total, 0);
        const netRevenue = deliveredRevenue; // Only delivered orders count as actual revenue

        // Daily breakdown for chart
        const dailyData: Record<string, { delivered: number; returned: number; shipped: number }> = {};
        
        orders.forEach(order => {
            const dateKey = order.createdAt.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { delivered: 0, returned: 0, shipped: 0 };
            }
            
            if (order.status === OrderStatus.DELIVERED) {
                dailyData[dateKey].delivered += order.total;
            } else if (order.status === OrderStatus.RETURNED) {
                dailyData[dateKey].returned += order.total;
            } else if (order.status === OrderStatus.SHIPPED) {
                dailyData[dateKey].shipped += order.total;
            }
        });

        const dailyRevenue = Object.entries(dailyData)
            .map(([date, values]) => ({
                date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                delivered: values.delivered,
                returned: values.returned,
                shipped: values.shipped,
            }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Order details for export
        const orderDetails = orders.map(order => ({
            id: order.id,
            date: order.createdAt.toLocaleDateString(),
            customer: order.customerName,
            product: order.product.name,
            quantity: order.quantity,
            total: order.total,
            status: order.status,
            trackingNumber: order.trackingNumber || 'N/A',
        }));

        return NextResponse.json({
            summary: {
                totalOrders: orders.length,
                deliveredOrders: deliveredOrders.length,
                returnedOrders: returnedOrders.length,
                shippedOrders: shippedOrders.length,
                pendingOrders: pendingOrders.length,
                cancelledOrders: cancelledOrders.length,
                deliveredRevenue,
                returnedValue,
                pendingValue,
                netRevenue,
                returnRate: orders.length > 0 ? ((returnedOrders.length / orders.length) * 100).toFixed(1) : '0',
                deliveryRate: orders.length > 0 ? ((deliveredOrders.length / orders.length) * 100).toFixed(1) : '0',
            },
            dailyRevenue,
            orders: orderDetails,
        });
    } catch (error) {
        console.error('Financial report error:', error);
        return NextResponse.json({ error: 'Failed to generate financial report' }, { status: 500 });
    }
}
