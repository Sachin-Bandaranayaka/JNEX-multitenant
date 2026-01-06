'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TruckIcon, MapPinIcon, CalendarIcon, CubeIcon } from '@heroicons/react/24/outline';
import { ShippingProvider } from '@prisma/client';

interface ShippedOrder {
    id: string;
    customerName: string;
    customerAddress: string;
    product: {
        name: string;
    };
    assignedTo: {
        name: string | null;
    } | null;
    shippedAt: Date | null;
    shippingProvider: ShippingProvider | null;
    trackingNumber: string | null;
}

interface ShippingListProps {
    orders: ShippedOrder[];
}

const SHIPPING_PROVIDERS: { key: ShippingProvider | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'All Partners' },
    { key: 'FARDA_EXPRESS', label: 'Farda Express' },
    { key: 'TRANS_EXPRESS', label: 'Trans Express' },
    { key: 'SL_POST', label: 'SL Post' },
    { key: 'ROYAL_EXPRESS', label: 'Royal Express' },
];

export function ShippingList({ orders }: ShippingListProps) {
    const [selectedProvider, setSelectedProvider] = useState<ShippingProvider | 'ALL'>('ALL');

    const getTrackingUrl = (provider: string, trackingNumber: string) => {
        switch (provider) {
            case 'FARDA_EXPRESS':
                return `https://farda-express.com/track?id=${trackingNumber}`;
            case 'TRANS_EXPRESS':
                return `https://trans-express.net/track/${trackingNumber}`;
            case 'SL_POST':
                return `https://posta.lk/tracking?id=${trackingNumber}`;
            case 'ROYAL_EXPRESS':
                return `https://royal-express.lk/track/${trackingNumber}`;
            default:
                return '#';
        }
    };

    const formatProviderName = (provider: string) => {
        return provider.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };

    // Group orders by provider and count them
    const orderCountByProvider = useMemo(() => {
        const counts: Record<string, number> = { ALL: orders.length };
        orders.forEach((order) => {
            if (order.shippingProvider) {
                counts[order.shippingProvider] = (counts[order.shippingProvider] || 0) + 1;
            }
        });
        return counts;
    }, [orders]);

    // Filter orders based on selected provider
    const filteredOrders = useMemo(() => {
        if (selectedProvider === 'ALL') return orders;
        return orders.filter((order) => order.shippingProvider === selectedProvider);
    }, [orders, selectedProvider]);

    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="bg-muted/50 rounded-full p-4 mb-4">
                    <TruckIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground">No shipped orders found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Orders will appear here once they are shipped.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Provider Tabs */}
            <div className="flex flex-wrap gap-2">
                {SHIPPING_PROVIDERS.map((provider) => {
                    const count = orderCountByProvider[provider.key] || 0;
                    const isActive = selectedProvider === provider.key;
                    
                    // Don't show tabs for providers with no orders (except ALL)
                    if (provider.key !== 'ALL' && count === 0) return null;

                    return (
                        <button
                            key={provider.key}
                            onClick={() => setSelectedProvider(provider.key)}
                            className={`
                                inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                                ${isActive 
                                    ? 'bg-primary text-primary-foreground shadow-md' 
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }
                            `}
                        >
                            {provider.label}
                            <span className={`
                                inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold
                                ${isActive 
                                    ? 'bg-primary-foreground/20 text-primary-foreground' 
                                    : 'bg-muted text-muted-foreground'
                                }
                            `}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Orders Grid */}
            {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="bg-muted/50 rounded-full p-4 mb-4">
                        <TruckIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">No orders for this provider</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Try selecting a different shipping partner.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredOrders.map((order, index) => (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative bg-card hover:bg-accent/5 rounded-3xl border border-border p-6 transition-all duration-200 hover:shadow-md flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                        <TruckIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <Link href={`/orders/${order.id}`} className="font-semibold text-foreground hover:text-primary transition-colors truncate max-w-[150px] block">
                                            Order #{order.id.slice(0, 8)}
                                        </Link>
                                        <div className="text-xs text-muted-foreground">
                                            {order.shippingProvider ? formatProviderName(order.shippingProvider) : 'Unknown Provider'}
                                        </div>
                                    </div>
                                </div>
                                {order.trackingNumber && order.shippingProvider && (
                                    <a
                                        href={getTrackingUrl(order.shippingProvider, order.trackingNumber)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 hover:bg-indigo-200 dark:hover:bg-indigo-500/20 transition-colors"
                                    >
                                        Track
                                    </a>
                                )}
                            </div>

                            <div className="space-y-3 text-sm text-muted-foreground flex-grow">
                                <div className="flex items-start gap-2">
                                    <CubeIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2 text-foreground">{order.product.name}</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <MapPinIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2">{order.customerAddress}</span>
                                </div>
                                {order.shippedAt && (
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="h-4 w-4 flex-shrink-0" />
                                        <span>Shipped {format(new Date(order.shippedAt), 'MMM d, yyyy')}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-4 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                                <div>
                                    {order.assignedTo ? (
                                        <span>Agent: <span className="font-medium text-foreground">{order.assignedTo.name}</span></span>
                                    ) : (
                                        <span>Unassigned</span>
                                    )}
                                </div>
                                <div className="font-mono bg-muted/50 px-2 py-1 rounded">
                                    {order.trackingNumber || 'No Tracking'}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
