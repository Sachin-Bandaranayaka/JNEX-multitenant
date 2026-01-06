// src/app/api/reports/financial/export/route.ts

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getScopedPrismaClient } from '@/lib/prisma';
import { OrderStatus } from '@prisma/client';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId || session.user.role !== 'ADMIN') {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const format = searchParams.get('format') || 'excel';

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

        // Calculate summary
        const deliveredOrders = orders.filter(o => o.status === OrderStatus.DELIVERED);
        const returnedOrders = orders.filter(o => o.status === OrderStatus.RETURNED);
        const deliveredRevenue = deliveredOrders.reduce((sum, o) => sum + o.total, 0);
        const returnedValue = returnedOrders.reduce((sum, o) => sum + o.total, 0);

        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            
            // Summary Sheet
            const summarySheet = workbook.addWorksheet('Summary');
            summarySheet.columns = [
                { header: 'Metric', key: 'metric', width: 30 },
                { header: 'Value', key: 'value', width: 20 },
            ];
            summarySheet.getRow(1).font = { bold: true };
            summarySheet.addRows([
                { metric: 'Report Period', value: `${startDate} to ${endDate}` },
                { metric: 'Total Orders', value: orders.length },
                { metric: 'Delivered Orders', value: deliveredOrders.length },
                { metric: 'Returned Orders', value: returnedOrders.length },
                { metric: 'Delivered Revenue (LKR)', value: deliveredRevenue },
                { metric: 'Returned Value (LKR)', value: returnedValue },
                { metric: 'Net Revenue (LKR)', value: deliveredRevenue },
                { metric: 'Return Rate (%)', value: orders.length > 0 ? ((returnedOrders.length / orders.length) * 100).toFixed(1) : '0' },
            ]);

            // Orders Sheet
            const ordersSheet = workbook.addWorksheet('Order Details');
            ordersSheet.columns = [
                { header: 'Order ID', key: 'id', width: 20 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Customer', key: 'customer', width: 25 },
                { header: 'Product', key: 'product', width: 30 },
                { header: 'Quantity', key: 'quantity', width: 10 },
                { header: 'Total (LKR)', key: 'total', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Tracking #', key: 'tracking', width: 20 },
            ];
            ordersSheet.getRow(1).font = { bold: true };
            
            orders.forEach(order => {
                ordersSheet.addRow({
                    id: order.id,
                    date: order.createdAt.toLocaleDateString(),
                    customer: order.customerName,
                    product: order.product.name,
                    quantity: order.quantity,
                    total: order.total,
                    status: order.status,
                    tracking: order.trackingNumber || 'N/A',
                });
            });

            // Delivered Orders Sheet
            const deliveredSheet = workbook.addWorksheet('Delivered Orders');
            deliveredSheet.columns = ordersSheet.columns;
            deliveredSheet.getRow(1).font = { bold: true };
            deliveredOrders.forEach(order => {
                deliveredSheet.addRow({
                    id: order.id,
                    date: order.createdAt.toLocaleDateString(),
                    customer: order.customerName,
                    product: order.product.name,
                    quantity: order.quantity,
                    total: order.total,
                    status: order.status,
                    tracking: order.trackingNumber || 'N/A',
                });
            });

            // Returned Orders Sheet
            const returnedSheet = workbook.addWorksheet('Returned Orders');
            returnedSheet.columns = ordersSheet.columns;
            returnedSheet.getRow(1).font = { bold: true };
            returnedOrders.forEach(order => {
                returnedSheet.addRow({
                    id: order.id,
                    date: order.createdAt.toLocaleDateString(),
                    customer: order.customerName,
                    product: order.product.name,
                    quantity: order.quantity,
                    total: order.total,
                    status: order.status,
                    tracking: order.trackingNumber || 'N/A',
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();

            return new NextResponse(buffer, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="financial-report-${startDate}-to-${endDate}.xlsx"`,
                },
            });
        }

        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    } catch (error) {
        console.error('Financial export error:', error);
        return NextResponse.json({ error: 'Failed to export financial report' }, { status: 500 });
    }
}
