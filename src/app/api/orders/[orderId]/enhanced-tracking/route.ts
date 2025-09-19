import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';
import { ShipmentStatus } from '@/lib/shipping/types';

export const dynamic = 'force-dynamic';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await params;

        // Get order with tenant information
        const order = await prisma.order.findUnique({
            where: { 
                id: resolvedParams.orderId,
                tenantId: session.user.tenantId 
            },
            include: {
                tenant: {
                    select: {
                        royalExpressApiKey: true,
                    },
                },
            },
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (!order.trackingNumber || order.shippingProvider !== 'ROYAL_EXPRESS') {
            return NextResponse.json(
                { error: 'Order is not shipped with Royal Express or has no tracking number' },
                { status: 400 }
            );
        }

        const royalApiKey = order.tenant?.royalExpressApiKey;
        if (!royalApiKey) {
            return NextResponse.json(
                { error: 'Royal Express API key missing' },
                { status: 500 }
            );
        }

        const [royalEmail, royalPassword] = royalApiKey.split(':');
        if (!royalEmail || !royalPassword) {
            return NextResponse.json(
                { error: 'Royal Express API key format invalid (expected email:password)' },
                { status: 500 }
            );
        }

        const royalExpressService = new RoyalExpressProvider(royalApiKey, 'royalexpress');
        console.log('Fetching enhanced tracking for order:', order.id, 'tracking:', order.trackingNumber);

        // Get enhanced tracking data
        const enhancedTracking = await royalExpressService.trackShipmentEnhanced(order.trackingNumber);
        console.log('Enhanced tracking data received:', {
            hasBasicStatus: !!enhancedTracking.basicStatus,
            hasEnhancedStatus: !!enhancedTracking.enhancedStatus,
            hasTrackingInfo: !!enhancedTracking.trackingInfo,
            hasFinancialInfo: !!enhancedTracking.financialInfo,
        });

        // Prepare database update with enhanced tracking data
        const updateData: any = {
            status: enhancedTracking.basicStatus === ShipmentStatus.DELIVERED ? 'DELIVERED' : 'SHIPPED',
            deliveredAt: enhancedTracking.basicStatus === ShipmentStatus.DELIVERED ? new Date() : null,
            trackingUpdates: {
                create: {
                    status: enhancedTracking.basicStatus,
                    timestamp: new Date(),
                    tenantId: order.tenantId,
                    description: enhancedTracking.enhancedStatus?.statusHistory?.[0]?.description || 'Enhanced tracking update',
                    location: enhancedTracking.enhancedStatus?.statusHistory?.[0]?.location,
                },
            },
        };

        // Handle status history separately
        if (enhancedTracking.enhancedStatus?.statusHistory) {
            // Clear existing status history and add new ones
            await prisma.orderStatusHistory.deleteMany({
                where: { orderId: order.id }
            });

            // Create new status history entries
            await prisma.orderStatusHistory.createMany({
                data: enhancedTracking.enhancedStatus.statusHistory.map((historyItem) => ({
                    orderId: order.id,
                    status: historyItem.status,
                    statusCode: historyItem.status.toUpperCase().replace(/\s+/g, '_'),
                    description: historyItem.description,
                    location: historyItem.location,
                    timestamp: new Date(historyItem.timestamp),
                    isCurrentStatus: historyItem === enhancedTracking.enhancedStatus!.statusHistory[0],
                    tenantId: order.tenantId,
                })),
            });
        }

        // Handle financial info separately
        if (enhancedTracking.financialInfo) {
            // Check if financial info already exists
            const existingFinancialInfo = await prisma.orderFinancialInfo.findUnique({
                where: { orderId: order.id }
            });

            if (existingFinancialInfo) {
                await prisma.orderFinancialInfo.update({
                    where: { orderId: order.id },
                    data: {
                        totalAmount: enhancedTracking.financialInfo.totalAmount,
                        shippingCost: enhancedTracking.financialInfo.shippingCost,
                        taxAmount: enhancedTracking.financialInfo.taxAmount,
                        discountAmount: enhancedTracking.financialInfo.discountAmount,
                        paymentStatus: enhancedTracking.financialInfo.paymentStatus,
                        paymentMethod: enhancedTracking.financialInfo.paymentMethod,
                        currency: enhancedTracking.financialInfo.currency,
                    },
                });
            } else {
                await prisma.orderFinancialInfo.create({
                    data: {
                        orderId: order.id,
                        totalAmount: enhancedTracking.financialInfo.totalAmount,
                        shippingCost: enhancedTracking.financialInfo.shippingCost,
                        taxAmount: enhancedTracking.financialInfo.taxAmount,
                        discountAmount: enhancedTracking.financialInfo.discountAmount,
                        paymentStatus: enhancedTracking.financialInfo.paymentStatus,
                        paymentMethod: enhancedTracking.financialInfo.paymentMethod,
                        currency: enhancedTracking.financialInfo.currency,
                        tenantId: order.tenantId,
                    },
                });
            }
        }

        // Handle Royal Express tracking details separately
        if (enhancedTracking.trackingInfo?.data) {
            // Clear existing Royal Express tracking and add new ones
            await prisma.royalExpressTrackingDetail.deleteMany({
                where: { orderId: order.id }
            });

            await prisma.royalExpressTrackingDetail.create({
                data: {
                    orderId: order.id,
                    trackingNumber: order.trackingNumber!,
                    currentStatus: enhancedTracking.trackingInfo.data[0]?.status || 'UNKNOWN',
                    currentStatusCode: enhancedTracking.trackingInfo.data[0]?.status?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN',
                    lastLocationUpdate: enhancedTracking.trackingInfo.data[0]?.location,
                    lastLocationTimestamp: new Date(enhancedTracking.trackingInfo.data[0]?.timestamp || new Date()),
                    totalStatusUpdates: enhancedTracking.trackingInfo.data?.length || 1,
                    isDelivered: enhancedTracking.basicStatus === ShipmentStatus.DELIVERED,
                    isException: false,
                    tenantId: order.tenantId,
                },
            });
        }

        // Update order with basic tracking data
        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: updateData,
            include: {
                product: true,
                trackingUpdates: { orderBy: { timestamp: 'desc' } },
                statusHistory: { orderBy: { timestamp: 'desc' } },
                financialInfo: true,
                royalExpressTracking: true,
            },
        });

        console.log('Order updated with enhanced tracking data:', {
            orderId: updatedOrder.id,
            statusHistory: updatedOrder.statusHistory?.length || 0,
            hasFinancialInfo: !!updatedOrder.financialInfo,
            hasRoyalExpressTracking: !!updatedOrder.royalExpressTracking,
        });

        return NextResponse.json({
            success: true,
            order: updatedOrder,
            enhancedData: {
                statusHistory: enhancedTracking.enhancedStatus?.statusHistory?.length || 0,
                hasFinancialInfo: !!enhancedTracking.financialInfo,
                hasTrackingInfo: !!enhancedTracking.trackingInfo,
            },
        });

    } catch (error) {
        console.error('Enhanced tracking error:', error);
        return NextResponse.json(
            { 
                error: 'Failed to fetch enhanced tracking data',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}