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
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-2xl bg-muted/30">
                        <div className="h-10 w-10 rounded-full bg-muted"></div>
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500 text-sm p-4 rounded-2xl bg-red-50">
                Error loading delivered orders: {error}
            </div>
        );
    }

    if (!data || data.orders.length === 0) {
        return (
            <div className="text-muted-foreground text-sm text-center py-8">
                <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                No delivered orders in the last 30 days
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary Stats - Optional, maybe remove if too cluttered, but good for context */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="p-3 rounded-2xl bg-muted/30 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</div>
                    <div className="text-lg font-bold text-foreground">{data.summary.totalDeliveredOrders}</div>
                </div>
                <div className="p-3 rounded-2xl bg-muted/30 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Revenue</div>
                    <div className="text-lg font-bold text-foreground">{(data.summary.totalRevenue / 1000).toFixed(1)}k</div>
                </div>
                <div className="p-3 rounded-2xl bg-muted/30 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avg</div>
                    <div className="text-lg font-bold text-foreground">{(data.summary.averageOrderValue / 1000).toFixed(1)}k</div>
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
                        className="group flex items-center justify-between p-4 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-colors"
                    >
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                <CheckCircle className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <Link
                                    href={`/orders/${order.id}`}
                                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block"
                                >
                                    {order.customerName}
                                </Link>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                                    <span>#{order.orderNumber}</span>
                                    <span>•</span>
                                    <span className="truncate">{order.productName}</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-foreground">
                                {formatCurrency(order.total)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {formatDate(order.deliveredAt)}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}