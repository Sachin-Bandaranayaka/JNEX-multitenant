import { OrderStatus, ShippingProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { FardaExpressService } from '@/lib/shipping/farda-express';
import { RoyalExpressProvider } from '@/lib/shipping/royal-express';
import { ShipmentStatus } from '@/lib/shipping/types';
import { createNotification } from '@/lib/notifications';
import { applyCourierStatus } from '@/lib/courier-status-sync';

// Force dynamic rendering - disable all caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// This endpoint will be called by a cron job every hour
export async function GET(request: Request) {
    // Add no-cache headers helper
    const createResponse = (data: any, status: number = 200) => {
        return NextResponse.json(data, {
            status,
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    };

    try {
        // Verify the request is from our cron service
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
            return createResponse({ error: 'Unauthorized' }, 401);
        }

        // Get all orders that are shipped but not delivered
        const staleBefore = new Date(Date.now() - 10 * 60 * 1000);
        const orders = await prisma.order.findMany({
            where: {
                status: OrderStatus.SHIPPED,
                shippingProvider: { not: null },
                trackingNumber: { not: null },
                deliveredAt: null,
                OR: [{ lastTrackingCheckedAt: null }, { lastTrackingCheckedAt: { lt: staleBefore } }],
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

        // Work in small concurrent batches: materially faster than a global
        // two-second delay while still protecting courier rate limits.
        const updates: any[] = [];
        const concurrency = 4;
        for (let start = 0; start < orders.length; start += concurrency) {
          const batch = orders.slice(start, start + concurrency);
          const batchResults = await Promise.all(batch.map(async (order, offset) => {
            console.log(`Processing order ${start + offset + 1}/${orders.length}: ${order.id}`);

            const result = await (async () => {
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

                        // Record what the courier said, regardless of whether it
                        // moves the order to a new lifecycle state.
                        await prisma.trackingUpdate.create({
                            data: {
                                orderId: order.id,
                                tenantId: order.tenantId,
                                status: shipmentStatus,
                                timestamp: new Date(),
                                provider: ShippingProvider.FARDA_EXPRESS,
                                trackingNumber: order.trackingNumber,
                                isDelivered: shipmentStatus === ShipmentStatus.DELIVERED,
                                isException: shipmentStatus === ShipmentStatus.EXCEPTION,
                            },
                        });

                        const applied = await applyCourierStatus(order, shipmentStatus, 'Farda Express tracking');

                        return {
                            orderId: order.id,
                            success: true,
                            newStatus: shipmentStatus,
                            statusChanged: applied.changed,
                            ...(applied.skipped ? { skippedReason: applied.skipped } : {}),
                        };
                    } else if (order.shippingProvider === ShippingProvider.TRANS_EXPRESS) {
                        // NOTE: Trans Express automated tracking is intentionally disabled.
                        // Their tracking API is unreliable — it frequently returns a stale
                        // PENDING status even for delivered orders, which means orders never
                        // get marked DELIVERED automatically.
                        //
                        // Operators now bulk-import the daily Trans Express delivery export
                        // (Excel/CSV) via the /orders/bulk-update page, which matches against
                        // Order.trackingNumber and updates statuses reliably.
                        //
                        // The original API-based implementation can be recovered from git history
                        // (this commit) if it's ever needed again.
                        return {
                            orderId: order.id,
                            success: true,
                            skipped: true,
                            reason: 'Trans Express auto-tracking disabled; use /orders/bulk-update',
                        } as any;
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
                            const latest = enhancedTracking.enhancedStatus?.statusHistory?.[0];

                            await prisma.trackingUpdate.create({
                                data: {
                                    orderId: order.id,
                                    tenantId: order.tenantId,
                                    status: shipmentStatus,
                                    timestamp: new Date(),
                                    description: latest?.description || 'Status updated via cron job',
                                    location: latest?.location,
                                    provider: ShippingProvider.ROYAL_EXPRESS,
                                    trackingNumber: order.trackingNumber,
                                    isDelivered: shipmentStatus === ShipmentStatus.DELIVERED,
                                    isException: shipmentStatus === ShipmentStatus.EXCEPTION,
                                },
                            });

                            // Courier-reported history is informational; the
                            // authoritative current-status row is written by
                            // transitionOrder below.
                            if (enhancedTracking.enhancedStatus?.statusHistory?.length) {
                                await prisma.orderStatusHistory.createMany({
                                    data: enhancedTracking.enhancedStatus.statusHistory.map((historyItem) => ({
                                        orderId: order.id,
                                        tenantId: order.tenantId,
                                        status: historyItem.status,
                                        statusCode: historyItem.status,
                                        timestamp: new Date(historyItem.timestamp),
                                        description: historyItem.description,
                                        location: historyItem.location,
                                        isCurrentStatus: false,
                                    })),
                                    skipDuplicates: true,
                                });
                            }

                            if (enhancedTracking.financialInfo) {
                                const financial = enhancedTracking.financialInfo;
                                await prisma.orderFinancialInfo.upsert({
                                    where: { orderId: order.id },
                                    create: {
                                        orderId: order.id,
                                        tenantId: order.tenantId,
                                        totalAmount: financial.totalAmount,
                                        shippingCost: financial.shippingCost,
                                        taxAmount: financial.taxAmount,
                                        discountAmount: financial.discountAmount,
                                        paymentStatus: financial.paymentStatus,
                                        paymentMethod: financial.paymentMethod,
                                        currency: financial.currency,
                                    },
                                    update: {
                                        totalAmount: financial.totalAmount,
                                        shippingCost: financial.shippingCost,
                                        taxAmount: financial.taxAmount,
                                        discountAmount: financial.discountAmount,
                                        paymentStatus: financial.paymentStatus,
                                        paymentMethod: financial.paymentMethod,
                                        currency: financial.currency,
                                    },
                                });
                            }

                            if (enhancedTracking.enhancedStatus) {
                                const enhanced = enhancedTracking.enhancedStatus;
                                const detail = {
                                    trackingNumber: enhanced.trackingNumber || order.trackingNumber!,
                                    currentStatus: String(enhanced.currentStatus),
                                    currentStatusCode: String(enhanced.currentStatus),
                                    estimatedDelivery: enhanced.estimatedDelivery ? new Date(enhanced.estimatedDelivery) : null,
                                    actualDelivery: shipmentStatus === ShipmentStatus.DELIVERED ? new Date() : null,
                                    lastLocationUpdate: latest?.location ?? null,
                                    lastLocationTimestamp: latest?.timestamp ? new Date(latest.timestamp) : null,
                                    totalStatusUpdates: enhanced.statusHistory?.length ?? 0,
                                    isDelivered: shipmentStatus === ShipmentStatus.DELIVERED,
                                    isException: shipmentStatus === ShipmentStatus.EXCEPTION,
                                };
                                await prisma.royalExpressTrackingDetail.upsert({
                                    where: { orderId: order.id },
                                    create: { orderId: order.id, tenantId: order.tenantId, ...detail },
                                    update: detail,
                                });
                            }

                            const applied = await applyCourierStatus(order, shipmentStatus, 'Royal Express tracking');

                            if (shipmentStatus === ShipmentStatus.RESCHEDULED && applied.changed) {
                                // transitionOrder notifies on delivery and return;
                                // reschedules get their own message here.
                                await createNotification(
                                    order.tenantId,
                                    'Order Rescheduled',
                                    `Order #${order.id} has been rescheduled.`,
                                    'DELIVERY',
                                    order.id
                                );
                            }

                            return {
                                orderId: order.id,
                                success: true,
                                newStatus: shipmentStatus,
                                statusChanged: applied.changed,
                                ...(applied.skipped ? { skippedReason: applied.skipped } : {}),
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
                                    // Pass the full API key string (email:password)
                                    const royalExpressService = new RoyalExpressProvider(royalApiKey);
                                    const basicStatus = await royalExpressService.trackShipment(order.trackingNumber!);

                                    await prisma.trackingUpdate.create({
                                        data: {
                                            orderId: order.id,
                                            tenantId: order.tenantId,
                                            status: basicStatus,
                                            timestamp: new Date(),
                                            description: 'Basic tracking update (enhanced tracking failed)',
                                            provider: ShippingProvider.ROYAL_EXPRESS,
                                            trackingNumber: order.trackingNumber,
                                            isDelivered: basicStatus === ShipmentStatus.DELIVERED,
                                        },
                                    });

                                    const applied = await applyCourierStatus(order, basicStatus, 'Royal Express tracking');

                                    return {
                                        orderId: order.id,
                                        success: true,
                                        newStatus: basicStatus,
                                        statusChanged: applied.changed,
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
            })();

            await prisma.order.update({
              where: { id: order.id },
              data: result.success
                ? { lastTrackingCheckedAt: new Date(), trackingFailureCount: 0, trackingLastError: null }
                : { lastTrackingCheckedAt: new Date(), trackingFailureCount: { increment: 1 }, trackingLastError: result.error ?? 'Tracking failed' },
            });
            return result;
          }));
          updates.push(...batchResults);
        }

        return createResponse({
            processed: orders.length,
            updates,
        });
    } catch (error) {
        console.error('Error processing tracking updates:', error);
        return createResponse(
            { error: 'Failed to process tracking updates' },
            500
        );
    }
}
