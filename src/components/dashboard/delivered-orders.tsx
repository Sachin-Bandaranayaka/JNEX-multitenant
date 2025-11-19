'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Package, Phone, MapPin, Calendar, Truck } from 'lucide-react';
import Link from 'next/link';

interface DeliveredOrder {
    id: string;
    orderNumber: number;
    customerName: string;
    customerPhone: string;
    customerCity: string;
    total: number;
    deliveredAt: string;
    trackingNumber: string | null;
    shippingProvider: string | null;
    productName: string;
    productCode: string;
    quantity: number;
}

interface DeliveredOrdersData {
    orders: DeliveredOrder[];
    summary: {
        totalDeliveredOrders: number;
        totalRevenue: number;
        averageOrderValue: number;
    };
}

export function DeliveredOrders() {
    const [data, setData] = useState<DeliveredOrdersData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDeliveredOrders();
    }, []);

    const fetchDeliveredOrders = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/dashboard/delivered-orders');

            if (!response.ok) {
                throw new Error('Failed to fetch delivered orders');
            }

            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatCurrency = (amount: number) => {
        return `LKR ${amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-lg bg-card p-4 sm:p-6 ring-1 ring-border"
            >
                <h2 className="text-lg font-medium text-card-foreground mb-4">Recent Deliveries</h2>
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            </motion.div>
        );
    }

    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-lg bg-card p-4 sm:p-6 ring-1 ring-border"
            >
                <h2 className="text-lg font-medium text-card-foreground mb-4">Recent Deliveries</h2>
                <div className="text-red-400 text-sm">
                    Error loading delivered orders: {error}
                </div>
            </motion.div>
        );
    }

    if (!data || data.orders.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-lg bg-card p-4 sm:p-6 ring-1 ring-border"
            >
                <h2 className="text-lg font-medium text-card-foreground mb-4">Recent Deliveries</h2>
                <div className="text-muted-foreground text-sm text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                    No delivered orders in the last 30 days
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-lg bg-gray-800 p-4 sm:p-6 ring-1 ring-white/10"
        >
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-card-foreground">Recent Deliveries</h2>
                <Link
                    href="/orders?status=DELIVERED"
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                    View all
                </Link>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                <div className="rounded-lg bg-accent/50 p-3 ring-1 ring-border">
                    <div className="text-xs text-muted-foreground">Total Delivered</div>
                    <div className="mt-1 text-lg font-semibold text-card-foreground">
                        {data.summary.totalDeliveredOrders}
                    </div>
                </div>
                <div className="rounded-lg bg-accent/50 p-3 ring-1 ring-border">
                    <div className="text-xs text-muted-foreground">Revenue</div>
                    <div className="mt-1 text-lg font-semibold text-card-foreground">
                        {formatCurrency(data.summary.totalRevenue)}
                    </div>
                </div>
                <div className="rounded-lg bg-accent/50 p-3 ring-1 ring-border">
                    <div className="text-xs text-muted-foreground">Avg Order Value</div>
                    <div className="mt-1 text-lg font-semibold text-card-foreground">
                        {formatCurrency(data.summary.averageOrderValue)}
                    </div>
                </div>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
                {data.orders.map((order, index) => (
                    <motion.div
                        key={order.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className="rounded-lg bg-accent/30 p-4 ring-1 ring-border hover:bg-accent/50 transition-colors"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                                    <Link
                                        href={`/orders/${order.id}`}
                                        className="text-sm font-medium text-card-foreground hover:text-primary transition-colors truncate"
                                    >
                                        Order #{order.orderNumber}
                                    </Link>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <Package className="h-3 w-3" />
                                        <span className="truncate">{order.productName}</span>
                                        <span className="text-muted-foreground">×{order.quantity}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>{formatDate(order.deliveredAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Phone className="h-3 w-3" />
                                        <span className="truncate">{order.customerName}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        <span className="truncate">{order.customerCity}</span>
                                    </div>
                                    {order.trackingNumber && (
                                        <div className="flex items-center gap-1 sm:col-span-2">
                                            <Truck className="h-3 w-3" />
                                            <span className="truncate">{order.trackingNumber}</span>
                                            {order.shippingProvider && (
                                                <span className="text-muted-foreground">
                                                    via {order.shippingProvider}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="text-right ml-4">
                                <div className="text-sm font-semibold text-card-foreground">
                                    {formatCurrency(order.total)}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}