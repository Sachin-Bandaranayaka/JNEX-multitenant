// src/app/api/search/route.ts

import { getScopedPrismaClient } from '@/lib/prisma'; // <-- Import our scoped client
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        // 1. Secure the route with session and tenantId check
        if (!session?.user?.tenantId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 2. Use the scoped client
        const prisma = getScopedPrismaClient(session.user.tenantId);

        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');

        if (!query) {
            return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
        }

        // 3. This query is now SECURE. It will only search for orders within the current tenant.
        const orders = await prisma.order.findMany({
            where: {
                OR: [
                    { customerName: { contains: query, mode: 'insensitive' } },
                    { customerPhone: { contains: query, mode: 'insensitive' } },
                    { id: { contains: query, mode: 'insensitive' } },
                    { trackingNumber: { contains: query, mode: 'insensitive' } },
                ],
            },
            include: {
                product: {
                    select: {
                        name: true,
                        price: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // The rest of the logic for grouping results remains the same
        const customerMap = new Map();
        orders.forEach(order => {
            const key = `${order.customerName}-${order.customerPhone}`;
            if (!customerMap.has(key)) {
                customerMap.set(key, {
                    customerName: order.customerName,
                    customerPhone: order.customerPhone,
                    customerAddress: order.customerAddress,
                    orders: [],
                });
            }
            customerMap.get(key).orders.push({
                id: order.id,
                createdAt: order.createdAt,
                status: order.status,
                product: order.product,
                quantity: order.quantity,
            });
        });

        const results = Array.from(customerMap.values());

        return NextResponse.json(results);
    } catch (error) {
        console.error('Error searching customers:', error);
        return NextResponse.json({ error: 'Failed to search customers' }, { status: 500 });
    }
}