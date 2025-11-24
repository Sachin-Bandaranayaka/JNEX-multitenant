'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircleIcon,
    TruckIcon,
    CubeIcon,
    MapPinIcon,
    ExclamationTriangleIcon,
    CurrencyDollarIcon,
    ChartBarIcon,
    ArrowPathIcon,
    ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

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

// Helper function to get Royal Express specific status icons
const getRoyalExpressStatusIcon = (status: string, statusCode: string) => {
    if (statusCode === 'EXCEPTION') return <ExclamationTriangleIcon className="h-5 w-5" />;

    switch (status) {
        case 'DELIVERED': return <CheckCircleIcon className="h-5 w-5" />;
        case 'OUT_FOR_DELIVERY': return <TruckIcon className="h-5 w-5" />;
        case 'IN_TRANSIT': return <TruckIcon className="h-5 w-5" />;
        case 'PICKED_UP': return <CubeIcon className="h-5 w-5" />;
        case 'PROCESSING': return <ArrowPathIcon className="h-5 w-5" />;
        case 'PENDING': return <ClockIcon className="h-5 w-5" />;
        case 'CANCELLED': return <ExclamationTriangleIcon className="h-5 w-5" />;
        case 'RETURNED': return <ArrowPathIcon className="h-5 w-5" />;
        default: return <MapPinIcon className="h-5 w-5" />;
    }
};

function ClockIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

export function EnhancedOrderTimeline({ order }: EnhancedOrderTimelineProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showFinancialInfo, setShowFinancialInfo] = useState(false);
    const [showDetailedTracking, setShowDetailedTracking] = useState(false);

    const hasTracking = Boolean(order.trackingNumber && order.shippingProvider);
    const isRoyalExpress = order.shippingProvider === 'ROYAL_EXPRESS';
    const hasEnhancedData = isRoyalExpress && (order.statusHistory?.length || order.financialInfo || order.royalExpressTracking);

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
                icon: <CubeIcon className="h-5 w-5" />,
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
                icon: <TruckIcon className="h-5 w-5" />,
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
                    icon: getRoyalExpressStatusIcon(statusUpdate.status, statusUpdate.statusCode),
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
                icon: <TruckIcon className="h-5 w-5" />,
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
                icon: <CheckCircleIcon className="h-5 w-5" />,
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
                    className="rounded-xl bg-card p-6 border border-border shadow-sm"
                >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h4 className="text-lg font-semibold text-primary flex items-center gap-2">
                                {order.shippingProvider?.replace('_', ' ')} Tracking
                                {isRoyalExpress && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Enhanced</span>}
                            </h4>
                            <p className="mt-1 text-sm text-muted-foreground font-mono">#{order.trackingNumber}</p>

                            <div className="mt-2 space-y-1">
                                {order.royalExpressTracking?.lastLocationUpdate && (
                                    <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                        <MapPinIcon className="h-4 w-4" />
                                        Current Location: {order.royalExpressTracking.lastLocationUpdate}
                                    </p>
                                )}
                                {order.royalExpressTracking?.estimatedDelivery && (
                                    <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                        <ClockIcon className="h-4 w-4" />
                                        Estimated Delivery: {format(new Date(order.royalExpressTracking.estimatedDelivery), 'PPp')}
                                    </p>
                                )}
                                {order.royalExpressTracking?.isException && order.royalExpressTracking?.exceptionDetails && (
                                    <p className="text-sm text-destructive flex items-center gap-1.5">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        Exception: {order.royalExpressTracking.exceptionDetails}
                                    </p>
                                )}
                            </div>
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

                    {/* Enhanced Royal Express Controls */}
                    {hasEnhancedData && (
                        <div className="mt-6 pt-4 border-t border-border flex gap-3">
                            {order.financialInfo && (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowFinancialInfo(!showFinancialInfo)}
                                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${showFinancialInfo
                                            ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                >
                                    <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                                    Financial Info
                                </motion.button>
                            )}
                            {royalExpressHistory.length > 0 && (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setShowDetailedTracking(!showDetailedTracking)}
                                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${showDetailedTracking
                                            ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                >
                                    <ChartBarIcon className="h-4 w-4 mr-2" />
                                    Detailed Tracking
                                </motion.button>
                            )}
                        </div>
                    )}
                </motion.div>
            )}

            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-destructive/10 p-4 border border-destructive/20"
                >
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        {error}
                    </p>
                </motion.div>
            )}

            {/* Financial Information Panel */}
            <AnimatePresence>
                {showFinancialInfo && order.financialInfo && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="rounded-xl bg-card p-6 border border-border shadow-sm mb-4">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <CurrencyDollarIcon className="h-4 w-4" />
                                Financial Information
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground uppercase">Total Amount</dt>
                                    <dd className="mt-1 text-lg font-bold text-foreground">
                                        {order.financialInfo.currency} {order.financialInfo.totalAmount.toLocaleString()}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground uppercase">Shipping Cost</dt>
                                    <dd className="mt-1 text-lg font-semibold text-blue-600 dark:text-blue-400">
                                        {order.financialInfo.currency} {order.financialInfo.shippingCost.toLocaleString()}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground uppercase">Tax Amount</dt>
                                    <dd className="mt-1 text-lg font-semibold text-amber-600 dark:text-amber-400">
                                        {order.financialInfo.currency} {order.financialInfo.taxAmount.toLocaleString()}
                                    </dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground uppercase">Payment Status</dt>
                                    <dd className="mt-1">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.financialInfo.paymentStatus === 'PAID'
                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : order.financialInfo.paymentStatus === 'PENDING'
                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
                                            }`}>
                                            {order.financialInfo.paymentStatus}
                                        </span>
                                    </dd>
                                </div>
                            </div>
                            {order.financialInfo.paymentMethod && (
                                <div className="mt-4 pt-4 border-t border-border">
                                    <p className="text-sm text-muted-foreground">
                                        Payment Method: <span className="font-medium text-foreground">{order.financialInfo.paymentMethod}</span>
                                    </p>
                                </div>
                            )}
                        </div>
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
                        className="overflow-hidden"
                    >
                        <div className="rounded-xl bg-card p-6 border border-border shadow-sm mb-4">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <ChartBarIcon className="h-4 w-4" />
                                Detailed Tracking History
                            </h4>
                            <div className="space-y-4">
                                {royalExpressHistory.map((event, index) => (
                                    <div key={index} className="flex items-start gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {event.status === 'DELIVERED'
                                                ? <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                                                : <MapPinIcon className="h-5 w-5 text-primary" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-foreground">
                                                {event.status?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                            </p>
                                            {event.description && (
                                                <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
                                            )}
                                            {event.location && (
                                                <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                                    <MapPinIcon className="h-3 w-3" />
                                                    {event.location}
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {format(new Date(event.timestamp), 'PPp')}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Enhanced Journey Timeline */}
            <div className="relative pl-4">
                <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-border" aria-hidden="true" />

                <div className="space-y-8">
                    {steps.map((step, stepIdx) => {
                        const isComplete = step.status === 'complete';
                        const isCurrent = step.status === 'current';
                        const isException = (step as any).isException;

                        return (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: stepIdx * 0.1 }}
                                className="relative flex gap-6"
                            >
                                <div className={`
                                    relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-[3px] shadow-sm transition-colors duration-300
                                    ${isException
                                        ? 'bg-destructive border-destructive text-destructive-foreground'
                                        : isComplete
                                            ? 'bg-primary border-primary text-primary-foreground'
                                            : isCurrent
                                                ? 'bg-background border-primary text-primary'
                                                : 'bg-muted/50 border-border text-muted-foreground'
                                    }
                                `}>
                                    {step.icon}
                                </div>

                                <div className={`flex-1 pt-1.5 ${!isComplete && !isCurrent && 'opacity-60'}`}>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                        <h3 className={`text-base font-semibold flex items-center gap-2 ${isComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {step.name}
                                            {isException && (
                                                <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">
                                                    Exception
                                                </span>
                                            )}
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
                                    {(step as any).location && (
                                        <p className="mt-1 text-xs text-primary flex items-center gap-1">
                                            <MapPinIcon className="h-3 w-3" />
                                            {(step as any).location}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Order Summary Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-xl bg-card border border-border shadow-sm overflow-hidden mt-8"
            >
                <div className="px-6 py-5">
                    <h4 className="text-lg font-medium text-primary mb-4">Order Summary</h4>
                    <div className="border-t border-border pt-6">
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Customer</dt>
                                <dd className="mt-1 text-sm text-foreground">
                                    <div className="space-y-1">
                                        <p className="font-medium">{order.customerName}</p>
                                        <p>{order.customerPhone}</p>
                                        <p className="text-xs text-muted-foreground">{order.customerAddress}</p>
                                    </div>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-muted-foreground">Product Details</dt>
                                <dd className="mt-1 text-sm text-foreground">
                                    <div className="space-y-1">
                                        <p className="font-medium">{order.product.name}</p>
                                        <p className="text-xs text-muted-foreground">Code: {order.product.code}</p>
                                        <div className="flex justify-between items-center pr-4">
                                            <span>Quantity: {order.quantity}</span>
                                            <span className="font-bold text-primary">
                                                {new Intl.NumberFormat('en-LK', {
                                                    style: 'currency',
                                                    currency: 'LKR',
                                                }).format((order.product.price * order.quantity) - (order.discount || 0))}
                                            </span>
                                        </div>
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