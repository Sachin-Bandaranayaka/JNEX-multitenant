'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, Package, RotateCw } from 'lucide-react';
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
    status: 'DELIVERED';
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
        return new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    const formatCurrency = (amount: number) => {
        return `Rs. ${amount.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
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
            <div className="flex items-center justify-between border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <span>Couldn&apos;t load recent deliveries.</span>
                <button onClick={fetchDeliveredOrders} className="inline-flex items-center gap-1 font-bold hover:underline"><RotateCw className="h-4 w-4" /> Retry</button>
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
        <div className="divide-y divide-slate-200 border-y border-slate-200">
                {data.orders.map((order, index) => (
                    <div
                        key={order.id}
                        className="group grid grid-cols-[1fr_auto] items-center gap-3 px-2 py-3 hover:bg-slate-50"
                    >
                        <div className="flex items-center gap-4 overflow-hidden">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                                <CheckCircle className="h-4 w-4" />
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
                                    <span className="truncate">{order.shippingProvider || 'Courier'} · {order.trackingNumber || 'No waybill'}</span>
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
                    </div>
                ))}
        </div>
    );
}
