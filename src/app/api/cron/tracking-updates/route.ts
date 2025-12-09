import { PrismaClient, OrderStatus, ShippingProvider } from '@prisma/client';
import { NextResponse } from 'next/server';
import { FardaExpressService } from '@/lib/shipping/farda-express';
import { TransExpressProvider } from '@/lib/shipping/trans-express';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';
import { ShipmentStatus } from '@/lib/shipping/types';
import { createNotification } from '@/lib/notifications';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// Map ShipmentStatus to OrderStatus
const statusMap: Record<ShipmentStatus, OrderStatus> = {
    [ShipmentStatus.PENDING]: OrderStatus.SHIPPED,
    [ShipmentStatus.IN_TRANSIT]: OrderStatus.SHIPPED,
    [ShipmentStatus.OUT_FOR_DELIVERY]: OrderStatus.SHIPPED,
    [ShipmentStatus.DELIVERED]: OrderStatus.DELIVERED,
    [ShipmentStatus.RETURNED]: OrderStatus.RETURNED,
    [ShipmentStatus.EXCEPTION]: OrderStatus.SHIPPED,
    [ShipmentStatus.RESCHEDULED]: OrderStatus.RESCHEDULED
};

// This endpoint will be called by a cron job every hour
export async function GET(request: Request) {
    try {
        // Verify the request is from our cron service
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Get all orders that are shipped but not delivered
        const orders = await prisma.order.findMany({
            where: {
                status: OrderStatus.SHIPPED,
                shippingProvider: { not: null },
                trackingNumber: { not: null },
                deliveredAt: null,
            },
            select: {
                id: true,
                shippingProvider: true,
                trackingNumber: true,
                status: true,
                customerPhone: true,
                customerEmail: true,
                tenantId: true,
                productId: true,
                quantity: true,
                userId: true,
                tenant: {
                    select: {
                        fardaExpressClientId: true,
                        fardaExpressApiKey: true,
                        transExpressApiKey: true,
                        royalExpressApiKey: true,
                    },
                },
            },
        });

        console.log(`Found ${orders.length} orders to check for updates`);

        const updates = await Promise.all(
            orders.map(async (order) => {
                try {
                    if (order.shippingProvider === ShippingProvider.FARDA_EXPRESS) {
                        const fardaClientId = order.tenant?.fardaExpressClientId;
                        const fardaApiKey = order.tenant?.fardaExpressApiKey;

                        if (!fardaClientId || !fardaApiKey) {
                            console.warn(`Farda Express credentials missing for tenant ${order.tenantId}`);
                            return {
                                orderId: order.id,
                                success: false,
                                error: 'Farda Express credentials missing',
                            };
                        }
                        const fardaService = new FardaExpressService(fardaClientId, fardaApiKey);
                        const shipmentStatus = await fardaService.trackShipment(order.trackingNumber!);

                        // Update order status
                        const updatedOrder = await prisma.order.update({
                            where: { id: order.id },
                            data: {
                                status: statusMap[shipmentStatus],
                                deliveredAt: shipmentStatus === ShipmentStatus.DELIVERED ? new Date() : null,
                                trackingUpdates: {
                                    create: {
                                        status: shipmentStatus,
                                        timestamp: new Date(),
                                        tenantId: order.tenantId,
                                    },
                                },
                            },
                        });

                        // Create notification for delivery
                        if (shipmentStatus === ShipmentStatus.DELIVERED) {
                            await createNotification(
                                order.tenantId,
                                'Order Delivered',
                                `Order #${order.id} has been delivered via Farda Express.`,
                                'DELIVERY',
                                order.id
                            );
                        } else if (shipmentStatus === ShipmentStatus.RETURNED) {
                            await createNotification(
                                order.tenantId,
                                'Order Returned',
                                `Order #${order.id} has been returned via Farda Express.`,
                                'RETURN',
                                order.id
                            );
                        }

                        return {
                            orderId: order.id,
                            success: true,
                            newStatus: shipmentStatus,
                        };
                    } else if (order.shippingProvider === ShippingProvider.TRANS_EXPRESS) {
                        try {
                            const transApiKey = order.tenant?.transExpressApiKey;

                            if (!transApiKey) {
                                console.warn(`Trans Express API key missing for tenant ${order.tenantId}`);
                                return {
                                    orderId: order.id,
                                    success: false,
                                    error: 'Trans Express API key missing',
                                };
                            }

                            const transExpressService = new TransExpressProvider(transApiKey);
                            const shipmentStatus = await transExpressService.trackShipment(order.trackingNumber!);

                            // Update order status
                            const updatedOrder = await prisma.order.update({
                                where: { id: order.id },
                                data: {
                                    status: statusMap[shipmentStatus],
                                    deliveredAt: shipmentStatus === ShipmentStatus.DELIVERED ? new Date() : null,
                                    trackingUpdates: {
                                        create: {
                                            status: shipmentStatus,
                                            timestamp: new Date(),
                                            tenantId: order.tenantId,
                                        },
                                    },
                                },
                            });

                            // Create notification for delivery
                            if (shipmentStatus === ShipmentStatus.DELIVERED) {
                                await createNotification(
                                    order.tenantId,
                                    'Order Delivered',
                                    `Order #${order.id} has been delivered via Trans Express.`,
                                    'DELIVERY',
                                    order.id
                                );
                            } else if (shipmentStatus === ShipmentStatus.RETURNED) {
                                await createNotification(
                                    order.tenantId,
                                    'Order Returned',
                                    `Order #${order.id} has been returned via Trans Express.`,
                                    'RETURN',
                                    order.id
                                );
                            }

                            return {
                                orderId: order.id,
                                success: true,
                                newStatus: shipmentStatus,
                            };
                        } catch (error) {
                            console.error(`Error updating Trans Express tracking for order ${order.id}:`, error);
                            return {
                                orderId: order.id,
                                success: false,
                                error: error instanceof Error ? error.message : 'Unknown Trans Express tracking error',
                            };
                        }
                    } else if (order.shippingProvider === ShippingProvider.ROYAL_EXPRESS) {
                        try {
                            const royalApiKey = order.tenant?.royalExpressApiKey;

                            if (!royalApiKey) {
                                console.warn(`Royal Express API key missing for tenant ${order.tenantId}`);
                                return {
                                    orderId: order.id,
                                    success: false,
                                    error: 'Royal Express API key not configured',
                                };
                            }

                            // Validate API key format (should be email:password)
                            const [royalEmail, royalPassword] = royalApiKey.split(':');
                            if (!royalEmail || !royalPassword) {
                                console.warn(`Royal Express API key format invalid for tenant ${order.tenantId}`);
                                return {
                                    orderId: order.id,
                                    success: false,
                                    error: 'Royal Express API key format invalid (expected email:password)',
                                };
                            }

                            const royalExpressService = new RoyalExpressProvider(royalApiKey, 'royalexpress');

                            // Use enhanced tracking to get comprehensive order information
                            const enhancedTracking = await royalExpressService.trackShipmentEnhanced(order.trackingNumber!);
                            const shipmentStatus = enhancedTracking.basicStatus;

                            // Prepare database update with enhanced tracking data
                            const updateData: any = {
                                status: statusMap[shipmentStatus],
                                deliveredAt: shipmentStatus === ShipmentStatus.DELIVERED ? new Date() : null,
                                trackingUpdates: {
                                    create: {
                                        status: shipmentStatus,
                                        timestamp: new Date(),
                                        tenantId: order.tenantId,
                                        description: enhancedTracking.enhancedStatus?.statusHistory?.[0]?.description || 'Status updated via cron job',
                                        location: enhancedTracking.enhancedStatus?.statusHistory?.[0]?.location,
                                    },
                                },
                            };

                            // Add enhanced status history if available
                            if (enhancedTracking.enhancedStatus?.statusHistory) {
                                updateData.statusHistory = {
                                    createMany: {
                                        data: enhancedTracking.enhancedStatus.statusHistory.map((historyItem) => ({
                                            status: historyItem.status,
                                            timestamp: new Date(historyItem.timestamp),
                                            description: historyItem.description,
                                            location: historyItem.location,
                                            tenantId: order.tenantId,
                                        })),
                                        skipDuplicates: true,
                                    },
                                };
                            }

                            // Add financial information if available
                            if (enhancedTracking.financialInfo) {
                                updateData.financialInfo = {
                                    upsert: {
                                        create: {
                                            totalAmount: enhancedTracking.financialInfo.totalAmount,
                                            shippingCost: enhancedTracking.financialInfo.shippingCost,
                                            taxAmount: enhancedTracking.financialInfo.taxAmount,
                                            discountAmount: enhancedTracking.financialInfo.discountAmount,
                                            paymentStatus: enhancedTracking.financialInfo.paymentStatus,
                                            paymentMethod: enhancedTracking.financialInfo.paymentMethod,
                                            currency: enhancedTracking.financialInfo.currency,
                                            tenantId: order.tenantId,
                                        },
                                        update: {
                                            totalAmount: enhancedTracking.financialInfo.totalAmount,
                                            shippingCost: enhancedTracking.financialInfo.shippingCost,
                                            taxAmount: enhancedTracking.financialInfo.taxAmount,
                                            discountAmount: enhancedTracking.financialInfo.discountAmount,
                                            paymentStatus: enhancedTracking.financialInfo.paymentStatus,
                                            paymentMethod: enhancedTracking.financialInfo.paymentMethod,
                                            currency: enhancedTracking.financialInfo.currency,
                                            updatedAt: new Date(),
                                        },
                                    },
                                };
                            }

                            // Add Royal Express tracking details if available
                            if (enhancedTracking.trackingInfo?.data) {
                                updateData.royalExpressTracking = {
                                    createMany: {
                                        data: enhancedTracking.trackingInfo.data.map((trackingItem) => ({
                                            trackingNumber: trackingItem.tracking_number,
                                            currentLocation: trackingItem.location,
                                            statusHistory: JSON.stringify([{
                                                status: trackingItem.status,
                                                timestamp: trackingItem.timestamp,
                                                description: trackingItem.description,
                                                location: trackingItem.location
                                            }]),
                                            tenantId: order.tenantId,
                                        })),
                                        skipDuplicates: true,
                                    },
                                };
                            }

                            // Update order with enhanced tracking data
                            const newStatus = statusMap[shipmentStatus];

                            // Check if this is a return that needs stock adjustment
                            if (newStatus === OrderStatus.RETURNED && order.status !== OrderStatus.RETURNED) {
                                // Fetch current product stock for accurate adjustment record
                                const product = await prisma.product.findUnique({
                                    where: { id: order.productId }
                                });

                                if (product) {
                                    // Use transaction to ensure data consistency
                                    await prisma.$transaction([
                                        // 1. Update Order
                                        prisma.order.update({
                                            where: { id: order.id },
                                            data: {
                                                ...updateData,
                                                status: newStatus,
                                            },
                                        }),
                                        // 2. Update Product Stock
                                        prisma.product.update({
                                            where: { id: order.productId },
                                            data: { stock: { increment: order.quantity } }
                                        }),
                                        // 3. Create Stock Adjustment Record
                                        prisma.stockAdjustment.create({
                                            data: {
                                                productId: order.productId,
                                                quantity: order.quantity,
                                                reason: `Order Returned (Auto-detected via Royal Express: ${order.trackingNumber})`,
                                                previousStock: product.stock,
                                                newStock: product.stock + order.quantity,
                                                userId: order.userId,
                                                tenantId: order.tenantId
                                            }
                                        })
                                    ]);
                                } else {
                                    // Product not found, just update order
                                    await prisma.order.update({
                                        where: { id: order.id },
                                        data: {
                                            ...updateData,
                                            status: newStatus,
                                        },
                                    });
                                }
                            } else {
                                // Normal update without stock adjustment
                                await prisma.order.update({
                                    where: { id: order.id },
                                    data: {
                                        ...updateData,
                                        status: newStatus,
                                    },
                                });
                            }

                            // Create notification for delivery
                            if (shipmentStatus === ShipmentStatus.DELIVERED) {
                                await createNotification(
                                    order.tenantId,
                                    'Order Delivered',
                                    `Order #${order.id} has been delivered via Royal Express.`,
                                    'DELIVERY',
                                    order.id
                                );
                            } else if (shipmentStatus === ShipmentStatus.RETURNED) {
                                await createNotification(
                                    order.tenantId,
                                    'Order Returned',
                                    `Order #${order.id} has been returned via Royal Express.`,
                                    'RETURN',
                                    order.id
                                );
                            } else if (shipmentStatus === ShipmentStatus.RESCHEDULED) {
                                await createNotification(
                                    order.tenantId,
                                    'Order Rescheduled',
                                    `Order #${order.id} has been rescheduled.`,
                                    'DELIVERY', // Using DELIVERY type for now, or could add RESCHEDULE type
                                    order.id
                                );
                            }

                            return {
                                orderId: order.id,
                                success: true,
                                newStatus: shipmentStatus,
                                enhancedData: {
                                    statusHistory: enhancedTracking.enhancedStatus?.statusHistory?.length || 0,
                                    hasFinancialInfo: !!enhancedTracking.financialInfo,
                                    hasTrackingInfo: !!enhancedTracking.trackingInfo,
                                },
                            };
                        } catch (error) {
                            console.error(`Error updating Royal Express tracking for order ${order.id}:`, error);

                            // Fallback to basic tracking if enhanced tracking fails
                            try {
                                const royalApiKey = order.tenant?.royalExpressApiKey;
                                if (royalApiKey) {
                                    const [royalEmail, royalPassword] = royalApiKey.split(':');
                                    const royalExpressService = new RoyalExpressProvider(royalEmail, royalPassword);
                                    const basicStatus = await royalExpressService.trackShipment(order.trackingNumber!);

                                    await prisma.order.update({
                                        where: { id: order.id },
                                        data: {
                                            status: statusMap[basicStatus],
                                            deliveredAt: basicStatus === ShipmentStatus.DELIVERED ? new Date() : null,
                                            trackingUpdates: {
                                                create: {
                                                    status: basicStatus,
                                                    timestamp: new Date(),
                                                    tenantId: order.tenantId,
                                                    description: 'Basic tracking update (enhanced tracking failed)',
                                                },
                                            },
                                        },
                                    });

                                    return {
                                        orderId: order.id,
                                        success: true,
                                        newStatus: basicStatus,
                                        fallbackUsed: true,
                                    };
                                }
                            } catch (fallbackError) {
                                console.error(`Fallback tracking also failed for order ${order.id}:`, fallbackError);
                            }

                            return {
                                orderId: order.id,
                                success: false,
                                error: error instanceof Error ? error.message : 'Unknown Royal Express tracking error',
                            };
                        }
                    }

                    // Handle other shipping providers here
                    return {
                        orderId: order.id,
                        success: false,
                        error: 'Unsupported shipping provider',
                    };
                } catch (error) {
                    console.error(`Error updating order ${order.id}:`, error);
                    return {
                        orderId: order.id,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    };
                }
            })
        );

        return NextResponse.json({
            processed: orders.length,
            updates,
        });
    } catch (error) {
        console.error('Error processing tracking updates:', error);
        return NextResponse.json(
            { error: 'Failed to process tracking updates' },
            { status: 500 }
        );
    }
}