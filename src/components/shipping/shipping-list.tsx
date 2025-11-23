'use client';

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

export function ShippingList({ orders }: ShippingListProps) {
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {orders.map((order, index) => (
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
    );
}
