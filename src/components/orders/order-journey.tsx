'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { EnhancedOrderTimeline } from './enhanced-order-timeline';

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

    // Use enhanced timeline for Royal Express orders with enhanced data
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
            date: format(new Date(order.createdAt), 'PPp'),
            status: 'complete',
            icon: (
                <motion.svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </motion.svg>
            )
        },
        {
            id: 2,
            name: 'Shipping Arranged',
            description: order.shippingProvider
                ? `${order.shippingProvider.replace('_', ' ')} - ${order.trackingNumber}`
                : 'Waiting for shipping details',
            date: order.shippedAt ? format(new Date(order.shippedAt), 'PPp') : undefined,
            status: order.shippingProvider ? 'complete' : 'current',
            icon: (
                <motion.svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </motion.svg>
            )
        },
        {
            id: 3,
            name: 'In Transit',
            description: order.trackingUpdates.length > 0
                ? order.trackingUpdates[0].description || 'Package is in transit'
                : 'Waiting for pickup',
            date: order.trackingUpdates[0]?.timestamp
                ? format(new Date(order.trackingUpdates[0].timestamp), 'PPp')
                : undefined,
            status: order.trackingUpdates.length > 0 ? 'complete' : 'upcoming',
            icon: (
                <motion.svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </motion.svg>
            )
        },
        {
            id: 4,
            name: 'Delivered',
            description: order.status === 'DELIVERED'
                ? 'Package has been delivered'
                : 'Waiting for delivery',
            date: order.trackingUpdates.find(u => u.status === 'DELIVERED')?.timestamp
                ? format(new Date(order.trackingUpdates.find(u => u.status === 'DELIVERED')!.timestamp), 'PPp')
                : undefined,
            status: order.status === 'DELIVERED' ? 'complete' : 'upcoming',
            icon: (
                <motion.svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </motion.svg>
            )
        }
    ];

    return (
        <div className="space-y-8">
            {/* Tracking Actions */}
            {hasTracking && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="rounded-lg bg-gray-800 p-6 ring-1 ring-white/10"
                >
                    <div className="flex justify-between items-center">
                        <div>
                            <h4 className="text-lg font-medium text-indigo-400">
                                {order.shippingProvider?.replace('_', ' ')} Tracking
                            </h4>
                            <p className="mt-1 text-sm text-gray-400">#{order.trackingNumber}</p>
                        </div>
                        <div className="flex space-x-4">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={checkTracking}
                                disabled={isLoading}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ring-1 ring-white/10 text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Checking...
                                    </>
                                ) : (
                                    'Check Updates'
                                )}
                            </motion.button>
                            {getTrackingUrl() && (
                                <motion.a
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    href={getTrackingUrl()!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-md ring-1 ring-white/10 text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Track on Carrier Site →
                                </motion.a>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {error && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-md bg-red-900/50 p-4 ring-1 ring-red-500"
                >
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-400">{error}</h3>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Journey Timeline */}
            <div className="flow-root">
                <ul role="list" className="-mb-8">
                    {steps.map((step, stepIdx) => (
                        <motion.li
                            key={step.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: stepIdx * 0.1 }}
                        >
                            <div className="relative pb-8">
                                {stepIdx !== steps.length - 1 ? (
                                    <span
                                        className={`absolute top-4 left-4 -ml-px h-full w-0.5 ${step.status === 'complete' ? 'bg-indigo-500' : 'bg-gray-700'
                                            }`}
                                        aria-hidden="true"
                                    />
                                ) : null}
                                <div className="relative flex space-x-3">
                                    <div>
                                        <span
                                            className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 ${step.status === 'complete'
                                                ? 'bg-indigo-500'
                                                : step.status === 'current'
                                                    ? 'bg-indigo-200'
                                                    : 'bg-gray-700'
                                                }`}
                                        >
                                            <span className={step.status === 'complete' ? 'text-white' : 'text-gray-400'}>
                                                {step.icon}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-gray-100">
                                            {step.name}
                                        </div>
                                        <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                                            <div className="mt-2 text-sm text-gray-400">
                                                {step.description}
                                            </div>
                                            {step.date && (
                                                <div className="mt-2 text-sm text-gray-400">
                                                    {step.date}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.li>
                    ))}
                </ul>
            </div>

            {/* Order Summary Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-lg bg-gray-800 ring-1 ring-white/10 overflow-hidden"
            >
                <div className="px-4 py-5 sm:p-6">
                    <h4 className="text-lg font-medium text-indigo-400">Order Summary</h4>
                    <div className="mt-6 border-t border-gray-700 pt-6">
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Customer</dt>
                                <dd className="mt-1 text-sm text-gray-100">
                                    <div className="space-y-1">
                                        <p className="font-medium">{order.customerName}</p>
                                        <p>{order.customerPhone}</p>
                                        <p className="text-xs">{order.customerAddress}</p>
                                    </div>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Product Details</dt>
                                <dd className="mt-1 text-sm text-gray-100">
                                    <div className="space-y-1">
                                        <p className="font-medium">{order.product.name}</p>
                                        <p className="text-xs">Code: {order.product.code}</p>
                                        <p>Quantity: {order.quantity}</p>
                                        {order.discount && order.discount > 0 && (
                                            <p>Discount: {new Intl.NumberFormat('en-LK', {
                                                style: 'currency',
                                                currency: 'LKR',
                                            }).format(order.discount)}</p>
                                        )}
                                        <p className="font-medium text-indigo-400">
                                            Total: {new Intl.NumberFormat('en-LK', {
                                                style: 'currency',
                                                currency: 'LKR',
                                            }).format((order.product.price * order.quantity) - (order.discount || 0))}
                                        </p>
                                    </div>
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}