'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircleIcon,
    TruckIcon,
    CubeIcon,
    MapPinIcon,
    ChevronDownIcon,
    ChevronUpIcon
} from '@heroicons/react/24/outline';
import { RoyalExpressTracking } from './royal-express-tracking';
import { EnhancedOrderTimeline } from './enhanced-order-timeline';

interface OrderJourneyHeaderProps {
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

export function OrderJourneyHeader({ order }: OrderJourneyHeaderProps) {
    const [showDetails, setShowDetails] = useState(false);

    const steps = [
        {
            id: 1,
            name: 'Created',
            date: format(new Date(order.createdAt), 'MMM d'),
            status: 'complete',
            icon: CubeIcon
        },
        {
            id: 2,
            name: 'Shipped',
            date: order.shippedAt ? format(new Date(order.shippedAt), 'MMM d') : undefined,
            status: order.shippingProvider ? 'complete' : 'current',
            icon: TruckIcon
        },
        {
            id: 3,
            name: 'In Transit',
            date: order.trackingUpdates[0]?.timestamp
                ? format(new Date(order.trackingUpdates[0].timestamp), 'MMM d')
                : undefined,
            status: order.trackingUpdates.length > 0 ? 'complete' : 'upcoming',
            icon: MapPinIcon
        },
        {
            id: 4,
            name: 'Delivered',
            date: order.trackingUpdates.find(u => u.status === 'DELIVERED')?.timestamp
                ? format(new Date(order.trackingUpdates.find(u => u.status === 'DELIVERED')!.timestamp), 'MMM d')
                : undefined,
            status: order.status === 'DELIVERED' ? 'complete' : 'upcoming',
            icon: CheckCircleIcon
        }
    ];

    // Calculate progress percentage for the bar
    const completedSteps = steps.filter(s => s.status === 'complete').length;
    const progress = Math.max(0, Math.min(100, ((completedSteps - 1) / (steps.length - 1)) * 100));

    return (
        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden mb-8">
            <div className="p-6 sm:p-8">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Order Journey</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Track the progress of order #{order.id.slice(-6)}
                        </p>
                    </div>

                    {order.shippingProvider && (
                        <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-xl border border-border/50">
                            <TruckIcon className="h-5 w-5 text-primary" />
                            <div className="text-sm">
                                <span className="text-muted-foreground">Shipped via </span>
                                <span className="font-medium text-foreground">{order.shippingProvider.replace('_', ' ')}</span>
                                {order.trackingNumber && (
                                    <span className="font-mono text-xs ml-2 bg-background px-1.5 py-0.5 rounded border border-border">
                                        #{order.trackingNumber}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Horizontal Stepper */}
                <div className="relative">
                    {/* Progress Bar Background */}
                    <div className="absolute top-6 left-0 w-full h-1 bg-muted rounded-full" />

                    {/* Active Progress Bar */}
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute top-6 left-0 h-1 bg-primary rounded-full"
                    />

                    <div className="relative flex justify-between">
                        {steps.map((step, index) => {
                            const isComplete = step.status === 'complete';
                            const isCurrent = step.status === 'current';

                            return (
                                <div key={step.id} className="flex flex-col items-center relative z-10">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={`
                                            w-12 h-12 rounded-full flex items-center justify-center border-4 transition-colors duration-300
                                            ${isComplete
                                                ? 'bg-primary border-primary text-primary-foreground'
                                                : isCurrent
                                                    ? 'bg-background border-primary text-primary ring-4 ring-primary/10'
                                                    : 'bg-background border-muted text-muted-foreground'
                                            }
                                        `}
                                    >
                                        <step.icon className="h-5 w-5" />
                                    </motion.div>

                                    <div className="mt-3 text-center">
                                        <p className={`text-sm font-semibold ${isComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {step.name}
                                        </p>
                                        {step.date && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {step.date}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Toggle Details Button */}
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                        {showDetails ? 'Hide Detailed Tracking' : 'Show Detailed Tracking'}
                        {showDetails ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {/* Detailed View (Collapsible) */}
            <AnimatePresence>
                {showDetails && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border bg-muted/10"
                    >
                        <div className="p-6 sm:p-8">
                            {order.shippingProvider === 'ROYAL_EXPRESS' && order.trackingNumber ? (
                                <RoyalExpressTracking
                                    orderId={order.id}
                                    trackingNumber={order.trackingNumber}
                                />
                            ) : (
                                <EnhancedOrderTimeline order={order} />
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
