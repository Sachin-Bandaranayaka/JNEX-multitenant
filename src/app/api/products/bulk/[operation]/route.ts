import { getScopedPrismaClient } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Parser } from 'json2csv';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ operation: string }> }
) {
    try {
        const resolvedParams = await params;
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        if (!session.user.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const prisma = getScopedPrismaClient(session.user.tenantId);

        switch (resolvedParams.operation) {
            case 'update-stock':
                return NextResponse.json(
                    { error: 'Stock is controlled by the platform owner.' },
                    { status: 403 },
                );
            case 'export-csv':
                return handleExportCsv(prisma);
            case 'check-low-stock':
                return handleLowStockCheck(prisma);
            default:
                return NextResponse.json(
                    { error: 'Invalid operation' },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('Error in bulk operation:', error);
        return NextResponse.json(
            { error: 'Failed to perform bulk operation' },
            { status: 500 }
        );
    }
}

async function handleExportCsv(prisma: ReturnType<typeof getScopedPrismaClient>) {
    try {
        const products = await prisma.product.findMany({
            include: {
                _count: {
                    select: {
                        orders: true,
                        leads: true,
                    },
                },
                stockAdjustments: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 1,
                },
            },
        });

        const fields = [
            { label: 'Code', value: 'code' },
            { label: 'Name', value: 'name' },
            { label: 'Description', value: 'description' },
            { label: 'Price', value: 'price' },
            { label: 'Current Stock', value: 'stock' },
            { label: 'Low Stock Alert', value: 'lowStockAlert' },
            { label: 'Total Orders', value: '_count.orders' },
            { label: 'Total Leads', value: '_count.leads' },
            { label: 'Last Updated', value: 'updatedAt' },
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(products);

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename=products.csv',
            },
        });
    } catch (error) {
        console.error('Error exporting products:', error);
        return NextResponse.json(
            { error: 'Failed to export products' },
            { status: 500 }
        );
    }
}

async function handleLowStockCheck(prisma: ReturnType<typeof getScopedPrismaClient>) {
    try {
        const lowStockProducts = await prisma.product.findMany({
            where: {
                stock: {
                    lte: prisma.product.fields.lowStockAlert,
                },
            },
            include: {
                _count: {
                    select: {
                        orders: true,
                    },
                },
            },
            orderBy: {
                stock: 'asc',
            },
        });

        const report = lowStockProducts.map(product => ({
            code: product.code,
            name: product.name,
            currentStock: product.stock,
            lowStockAlert: product.lowStockAlert,
            monthlyOrders: product._count.orders,
            status: product.stock === 0 ? 'Out of Stock' : 'Low Stock',
            reorderQuantity: Math.max(
                product.lowStockAlert * 2,
                Math.ceil(product._count.orders * 1.5)
            ),
        }));

        return NextResponse.json({
            totalProducts: report.length,
            outOfStock: report.filter(p => p.status === 'Out of Stock').length,
            lowStock: report.filter(p => p.status === 'Low Stock').length,
            products: report,
        });
    } catch (error) {
        console.error('Error checking low stock:', error);
        return NextResponse.json(
            { error: 'Failed to check low stock' },
            { status: 500 }
        );
    }
}
