// src/app/api/orders/sync-tracking/route.ts
// Manual trigger to sync all shipped orders with Royal Express

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getScopedPrismaClient, prisma as unscopedPrisma } from '@/lib/prisma';
import { OrderStatus, ShippingProvider } from '@prisma/client';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';
import { applyCourierStatus } from '@/lib/courier-status-sync';

export const dynamic = 'force-dynamic';

// Helper function to add delay between API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins can trigger sync
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const tenantId = session.user.tenantId;
        const prisma = getScopedPrismaClient(tenantId);

        // Get tenant's Royal Express API key
        const tenant = await unscopedPrisma.tenant.findUnique({
            where: { id: tenantId },
            select: { royalExpressApiKey: true },
        });

        if (!tenant?.royalExpressApiKey) {
            return NextResponse.json({
                error: 'Royal Express API key not configured',
                message: 'Please configure your Royal Express API key in settings'
            }, { status: 400 });
        }

        // Get all shipped orders with Royal Express
        const orders = await prisma.order.findMany({
            where: {
                status: OrderStatus.SHIPPED,
                shippingProvider: ShippingProvider.ROYAL_EXPRESS,
                trackingNumber: { not: null },
            },
            select: {
                id: true,
                trackingNumber: true,
                status: true,
                productId: true,
                quantity: true,
                userId: true,
            },
        });

        if (orders.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No shipped Royal Express orders to sync',
                processed: 0,
                updates: [],
            });
        }

        const royalExpressService = new RoyalExpressProvider(tenant.royalExpressApiKey, 'royalexpress');
        const updates = [];

        // Process orders sequentially with delay to avoid rate limiting
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];

            // Add delay between orders (skip first one)
            if (i > 0) {
                await delay(2000); // 2 second delay
            }

            try {
                const trackingResult = await royalExpressService.trackShipmentEnhanced(order.trackingNumber!);
                const shipmentStatus = trackingResult.basicStatus;

                // The state machine owns stock restoration, status history,
                // notifications and platform billing — this route only reports
                // what the courier said.
                const applied = await applyCourierStatus(
                    { ...order, tenantId },
                    shipmentStatus,
                    'Royal Express manual sync',
                    session.user.id,
                );

                if (!applied.changed) {
                    updates.push({
                        orderId: order.id,
                        success: true,
                        message: applied.skipped,
                        currentStatus: order.status,
                    });
                    continue;
                }

                updates.push({
                    orderId: order.id,
                    success: true,
                    previousStatus: order.status,
                    newStatus: applied.newStatus,
                    trackingStatus: shipmentStatus,
                });
            } catch (error) {
                updates.push({
                    orderId: order.id,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        const successCount = updates.filter(u => u.success && u.newStatus).length;
        const failCount = updates.filter(u => !u.success).length;

        return NextResponse.json({
            success: true,
            message: `Synced ${orders.length} orders. ${successCount} updated, ${failCount} failed.`,
            processed: orders.length,
            updated: successCount,
            failed: failCount,
            updates,
        });
    } catch (error) {
        console.error('Sync tracking error:', error);
        return NextResponse.json({
            error: 'Failed to sync orders',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
