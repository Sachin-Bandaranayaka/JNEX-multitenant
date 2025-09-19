'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface EnhancedOrderTimelineProps {
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

export function EnhancedOrderTimeline({ order }: EnhancedOrderTimelineProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showFinancialInfo, setShowFinancialInfo] = useState(false);
    const [showDetailedTracking, setShowDetailedTracking] = useState(false);

    const hasTracking = Boolean(order.trackingNumber && order.shippingProvider);
    const isRoyalExpress = order.shippingProvider === 'ROYAL_EXPRESS';
    const hasEnhancedData = isRoyalExpress && (order.statusHistory?.length || order.financialInfo || order.royalExpressTracking?.length);

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
            case 'ROYAL_EXPRESS':
                return `https://royalexpress.lk/track/${order.trackingNumber}`;
            case 'SL_POST':
                return `http://www.slpost.gov.lk/track-trace/${order.trackingNumber}`;
            default:
                return null;
        }
    };

    // Parse Royal Express tracking history
    const getRoyalExpressHistory = () => {
        if (!order.statusHistory?.length) return [];
        
        return order.statusHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    };

    const royalExpressHistory = getRoyalExpressHistory();

    // Enhanced timeline steps for Royal Express
    const getEnhancedSteps = () => {
        const baseSteps: any[] = [
            {
                id: 1,
                name: 'Order Created',
                description: 'Order has been created from lead',
                date: format(new Date(order.createdAt), 'PPp'),
                status: 'complete',
                icon: '📋',
                type: 'order'
            },
            {
                id: 2,
                name: 'Shipping Arranged',
                description: order.shippingProvider
                    ? `${order.shippingProvider.replace('_', ' ')} - ${order.trackingNumber}`
                    : 'Waiting for shipping details',
                date: order.shippedAt ? format(new Date(order.shippedAt), 'PPp') : undefined,
                status: order.shippingProvider ? 'complete' : 'current',
                icon: '📦',
                type: 'shipping'
            }
        ];

        // Add Royal Express enhanced tracking steps
        if (isRoyalExpress && order.statusHistory?.length) {
            const trackingSteps = order.statusHistory
                .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                .map((statusUpdate, index) => ({
                    id: 100 + index,
                    name: statusUpdate.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    description: statusUpdate.description || `Package ${statusUpdate.status.toLowerCase()}`,
                    location: statusUpdate.location,
                    date: format(new Date(statusUpdate.timestamp), 'PPp'),
                    status: statusUpdate.isCurrentStatus ? 'current' : 'complete',
                    icon: statusUpdate.status === 'DELIVERED' ? '✅' : statusUpdate.statusCode === 'EXCEPTION' ? '⚠️' : '🚚',
                    type: 'tracking' as const,
                    isDelivered: statusUpdate.status === 'DELIVERED',
                    isException: statusUpdate.statusCode === 'EXCEPTION'
                }));

            baseSteps.push(...trackingSteps);
        } else if (order.trackingUpdates.length > 0) {
            // Fallback to basic tracking updates
            baseSteps.push({
                id: 3,
                name: 'In Transit',
                description: order.trackingUpdates[0].description || 'Package is in transit',
                location: order.trackingUpdates[0].location,
                date: format(new Date(order.trackingUpdates[0].timestamp), 'PPp'),
                status: 'complete',
                icon: '🚚',
                type: 'tracking'
            });
        }

        // Add final delivery step if not already included
        const hasDeliveryStep = baseSteps.some(step => step.type === 'tracking' && (step as any).isDelivered);
        if (!hasDeliveryStep) {
            baseSteps.push({
                id: 999,
                name: 'Delivered',
                description: order.status === 'DELIVERED'
                    ? 'Package has been delivered'
                    : 'Waiting for delivery',
                date: order.trackingUpdates.find(u => u.status === 'DELIVERED')?.timestamp
                    ? format(new Date(order.trackingUpdates.find(u => u.status === 'DELIVERED')!.timestamp), 'PPp')
                    : undefined,
                status: order.status === 'DELIVERED' ? 'complete' : 'upcoming',
                icon: '✅',
                type: 'delivery'
            });
        }

        return baseSteps;
    };

    const steps = getEnhancedSteps();

    return (
        <div className="space-y-8">
            {/* Enhanced Tracking Actions */}
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
                                {isRoyalExpress && <span className="ml-2 text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">Enhanced</span>}
                            </h4>
                            <p className="mt-1 text-sm text-gray-400">#{order.trackingNumber}</p>
                            {order.royalExpressTracking?.lastLocationUpdate && (
                                <p className="mt-1 text-sm text-green-400">
                                    📍 Current Location: {order.royalExpressTracking.lastLocationUpdate}
                                </p>
                            )}
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

                    {/* Enhanced Royal Express Controls */}
                    {hasEnhancedData && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                            <div className="flex space-x-4">
                                {order.financialInfo && (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowFinancialInfo(!showFinancialInfo)}
                                        className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ring-1 ring-white/10 text-gray-300 bg-gray-700 hover:bg-gray-600"
                                    >
                                        💰 Financial Info
                                    </motion.button>
                                )}
                                {royalExpressHistory.length > 0 && (
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => setShowDetailedTracking(!showDetailedTracking)}
                                        className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ring-1 ring-white/10 text-gray-300 bg-gray-700 hover:bg-gray-600"
                                    >
                                        📊 Detailed Tracking
                                    </motion.button>
                                )}
                            </div>
                        </div>
                    )}
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

            {/* Financial Information Panel */}
            <AnimatePresence>
                {showFinancialInfo && order.financialInfo && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-lg bg-gray-800 p-6 ring-1 ring-white/10"
                    >
                        <h4 className="text-lg font-medium text-green-400 mb-4">💰 Financial Information</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Total Amount</dt>
                                <dd className="mt-1 text-lg font-semibold text-gray-100">
                                    {order.financialInfo.currency} {order.financialInfo.totalAmount.toLocaleString()}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Shipping Cost</dt>
                                <dd className="mt-1 text-lg font-semibold text-blue-400">
                                    {order.financialInfo.currency} {order.financialInfo.shippingCost.toLocaleString()}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Tax Amount</dt>
                                <dd className="mt-1 text-lg font-semibold text-yellow-400">
                                    {order.financialInfo.currency} {order.financialInfo.taxAmount.toLocaleString()}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-400">Payment Status</dt>
                                <dd className="mt-1">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        order.financialInfo.paymentStatus === 'PAID' 
                                            ? 'bg-green-100 text-green-800' 
                                            : order.financialInfo.paymentStatus === 'PENDING'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {order.financialInfo.paymentStatus}
                                    </span>
                                </dd>
                            </div>
                        </div>
                        {order.financialInfo.paymentMethod && (
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <p className="text-sm text-gray-400">
                                    Payment Method: {order.financialInfo.paymentMethod}
                                </p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Detailed Tracking Panel */}
            <AnimatePresence>
                {showDetailedTracking && royalExpressHistory.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-lg bg-gray-800 p-6 ring-1 ring-white/10"
                    >
                        <h4 className="text-lg font-medium text-blue-400 mb-4">📊 Detailed Tracking History</h4>
                        <div className="space-y-3">
                            {royalExpressHistory.map((event, index) => (
                                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-700/50 rounded-lg">
                                    <div className="flex-shrink-0">
                                        <span className="text-lg">{event.status === 'DELIVERED' ? '✅' : '📍'}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-100">
                                            {event.status?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                        </p>
                                        {event.description && (
                                            <p className="text-sm text-gray-400">{event.description}</p>
                                        )}
                                        {event.location && (
                                            <p className="text-sm text-blue-400">📍 {event.location}</p>
                                        )}
                                        <p className="text-xs text-gray-500">
                                            {format(new Date(event.timestamp), 'PPp')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Enhanced Journey Timeline */}
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
                                        className={`absolute top-4 left-4 -ml-px h-full w-0.5 ${
                                            step.status === 'complete' ? 'bg-indigo-500' : 'bg-gray-700'
                                        }`}
                                        aria-hidden="true"
                                    />
                                ) : null}
                                <div className="relative flex space-x-3">
                                    <div>
                                        <span
                                            className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900 text-lg ${
                                                step.status === 'complete'
                                                    ? (step as any).isException ? 'bg-yellow-500' : 'bg-indigo-500'
                                                    : step.status === 'current'
                                                    ? 'bg-indigo-200'
                                                    : 'bg-gray-700'
                                            }`}
                                        >
                                            {step.icon}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-gray-100">
                                            {step.name}
                                            {(step as any).isException && (
                                                <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
                                                    Exception
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
                                            <div className="mt-2 text-sm text-gray-400">
                                                {step.description}
                                            </div>
                                            {(step as any).location && (
                                                <div className="mt-2 text-sm text-blue-400">
                                                    📍 {(step as any).location}
                                                </div>
                                            )}
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