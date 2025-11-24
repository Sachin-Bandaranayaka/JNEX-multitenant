'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedOrderTimeline } from './enhanced-order-timeline';
import { RoyalExpressTracking } from './royal-express-tracking';
import {
    CheckCircleIcon,
    TruckIcon,
    CubeIcon,
    MapPinIcon,
    ArrowPathIcon,
    ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

interface OrderJourneyProps {
    order: {
        id: string;
        status: string;
        createdAt: Date;
        customerName: string;
        customerPhone: string;
        customerAddress: string;
        customerEmail?: string | null;
        product: {
            name: string;
            code: string;
            price: number;
        };
        quantity: number;
        discount?: number;
        shippingProvider?: string | null;
        trackingNumber?: string | null;
        shippedAt?: Date | null;
        trackingUpdates: Array<{
            id: string;
            status: string;
            location?: string | null;
            description?: string | null;
            timestamp: Date;
        }>;
        // Enhanced Royal Express tracking data
        statusHistory?: Array<{
            id: string;
            status: string;
            statusCode: string;
            description?: string | null;
            location?: string | null;
            timestamp: Date;
            isCurrentStatus: boolean;
        }>;
        financialInfo?: {
            id: string;
            totalAmount: number;
            shippingCost: number;
            taxAmount: number;
            discountAmount: number;
            paymentStatus: string;
            paymentMethod?: string | null;
            currency: string;
        } | null;
        royalExpressTracking?: {
            id: string;
            trackingNumber: string;
            currentStatus: string;
            currentStatusCode: string;
            estimatedDelivery?: Date | null;
            actualDelivery?: Date | null;
            lastLocationUpdate?: string | null;
            lastLocationTimestamp?: Date | null;
            totalStatusUpdates: number;
            isDelivered: boolean;
            isException: boolean;
            exceptionDetails?: string | null;
        } | null;
    };
}

export function OrderJourney({ order }: OrderJourneyProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasTracking = Boolean(order.trackingNumber && order.shippingProvider);
    const isRoyalExpress = order.shippingProvider === 'ROYAL_EXPRESS';
    const hasEnhancedData = isRoyalExpress && (order.statusHistory?.length || order.financialInfo || order.royalExpressTracking);

    // Use enhanced Royal Express tracking component for Royal Express orders with tracking number
    if (isRoyalExpress && order.trackingNumber) {
        return (
            <div className="space-y-6">
                <RoyalExpressTracking
                    orderId={order.id}
                    trackingNumber={order.trackingNumber}
                />
                {/* Fallback to enhanced timeline if needed */}
                {hasEnhancedData && (
                    <div className="border-t border-border pt-6">
                        <h4 className="text-lg font-medium text-foreground mb-4">Order Timeline</h4>
                        <EnhancedOrderTimeline order={order} />
                    </div>
                )}
            </div>
        );
    }

    // Use enhanced timeline for Royal Express orders with enhanced data but no tracking number
    if (hasEnhancedData) {
        return <EnhancedOrderTimeline order={order} />;
    }

    const checkTracking = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/orders/${order.id}/tracking`);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to fetch tracking information');
            }
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const getTrackingUrl = () => {
        if (!order.trackingNumber || !order.shippingProvider) return null;

        switch (order.shippingProvider) {
            case 'FARDA_EXPRESS':
                return `https://www.fdedomestic.com/track/${order.trackingNumber}`;
            case 'TRANS_EXPRESS':
                return `https://transexpress.lk/track-shipment/${order.trackingNumber}`;
            case 'SL_POST':
                return `http://www.slpost.gov.lk/track-trace/${order.trackingNumber}`;
            case 'ROYAL_EXPRESS':
                return `https://royalexpress.lk/track/${order.trackingNumber}`;
            default:
                return null;
        }
    };

    const steps = [
        {
            id: 1,
            name: 'Order Created',
            description: 'Order has been created from lead',
            date: format(new Date(order.createdAt), 'MMM d, yyyy h:mm a'),
            status: 'complete',
            icon: CubeIcon
        },
        {
            id: 2,
            name: 'Shipping Arranged',
            description: order.shippingProvider
                ? `${order.shippingProvider.replace('_', ' ')}`
                : 'Waiting for shipping details',
            subDescription: order.trackingNumber ? `#${order.trackingNumber}` : undefined,
            date: order.shippedAt ? format(new Date(order.shippedAt), 'MMM d, yyyy h:mm a') : undefined,
            status: order.shippingProvider ? 'complete' : 'current',
            icon: TruckIcon
        },
        {
            id: 3,
            name: 'In Transit',
            description: order.trackingUpdates.length > 0
                ? order.trackingUpdates[0].description || 'Package is in transit'
                : 'Waiting for pickup',
            date: order.trackingUpdates[0]?.timestamp
                ? format(new Date(order.trackingUpdates[0].timestamp), 'MMM d, yyyy h:mm a')
                : undefined,
            status: order.trackingUpdates.length > 0 ? 'complete' : 'upcoming',
            icon: MapPinIcon
        },
        {
            id: 4,
            name: 'Delivered',
            description: order.status === 'DELIVERED'
                ? 'Package has been delivered'
                : 'Waiting for delivery',
            date: order.trackingUpdates.find(u => u.status === 'DELIVERED')?.timestamp
                ? format(new Date(order.trackingUpdates.find(u => u.status === 'DELIVERED')!.timestamp), 'MMM d, yyyy h:mm a')
                : undefined,
            status: order.status === 'DELIVERED' ? 'complete' : 'upcoming',
            icon: CheckCircleIcon
        }
    ];

    return (
        <div className="space-y-8">
            {/* Tracking Actions Header */}
            {hasTracking && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-border">
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-lg font-semibold text-foreground">
                                {order.shippingProvider?.replace('_', ' ')}
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {order.status}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground font-mono">#{order.trackingNumber}</p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={checkTracking}
                            disabled={isLoading}
                            className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-xl text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {isLoading ? (
                                <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-4 w-4" />
                            ) : (
                                <ArrowPathIcon className="-ml-1 mr-2 h-4 w-4" />
                            )}
                            {isLoading ? 'Checking...' : 'Update Status'}
                        </motion.button>
                        {getTrackingUrl() && (
                            <motion.a
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                href={getTrackingUrl()!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 sm:flex-none inline-flex justify-center items-center px-4 py-2 text-sm font-medium rounded-xl border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-colors shadow-sm"
                            >
                                <span className="mr-2">Track</span>
                                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            </motion.a>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-destructive/10 p-4 border border-destructive/20"
                >
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                        <span className="text-lg">⚠️</span> {error}
                    </p>
                </motion.div>
            )}

            {/* Modern Vertical Timeline */}
            <div className="relative pl-4">
                {/* Vertical Line */}
                <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-border" aria-hidden="true" />

                <div className="space-y-8">
                    {steps.map((step, stepIdx) => {
                        const isComplete = step.status === 'complete';
                        const isCurrent = step.status === 'current';

                        return (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: stepIdx * 0.1 }}
                                className="relative flex gap-6"
                            >
                                {/* Icon Bubble */}
                                <div className={`
                                    relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-[3px] shadow-sm transition-colors duration-300
                                    ${isComplete
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : isCurrent
                                            ? 'bg-background border-primary text-primary'
                                            : 'bg-muted/50 border-border text-muted-foreground'
                                    }
                                `}>
                                    <step.icon className="h-6 w-6" aria-hidden="true" />
                                </div>

                                {/* Content */}
                                <div className={`flex-1 pt-1.5 ${!isComplete && !isCurrent && 'opacity-60'}`}>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                        <h3 className={`text-base font-semibold ${isComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {step.name}
                                        </h3>
                                        {step.date && (
                                            <time className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md whitespace-nowrap">
                                                {step.date}
                                            </time>
                                        )}
                                    </div>
                                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                                        {step.description}
                                    </p>
                                    {step.subDescription && (
                                        <p className="mt-1 text-xs font-mono text-primary/80 bg-primary/5 inline-block px-2 py-0.5 rounded">
                                            {step.subDescription}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Order Summary Section */}
            <div className="mt-8 pt-8 border-t border-border">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Order Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="group p-4 rounded-2xl bg-muted/30 border border-border/50 hover:border-primary/20 hover:bg-muted/50 transition-all">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-background shadow-sm text-primary">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Customer</p>
                                <p className="font-semibold text-foreground">{order.customerName}</p>
                                <p className="text-sm text-muted-foreground mt-0.5">{order.customerPhone}</p>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.customerAddress}</p>
                            </div>
                        </div>
                    </div>

                    <div className="group p-4 rounded-2xl bg-muted/30 border border-border/50 hover:border-primary/20 hover:bg-muted/50 transition-all">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-background shadow-sm text-primary">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Product</p>
                                <p className="font-semibold text-foreground">{order.product.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-mono bg-background px-1.5 py-0.5 rounded border border-border">
                                        {order.product.code}
                                    </span>
                                    <span className="text-xs text-muted-foreground">x{order.quantity}</span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-border/50 flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Total</span>
                                    <span className="text-sm font-bold text-primary">
                                        {new Intl.NumberFormat('en-LK', {
                                            style: 'currency',
                                            currency: 'LKR',
                                        }).format((order.product.price * order.quantity) - (order.discount || 0))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}