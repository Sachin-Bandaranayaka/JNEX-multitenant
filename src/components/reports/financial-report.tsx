'use client';

import { useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { ArrowDownTrayIcon, CheckCircleIcon, XCircleIcon, TruckIcon, ClockIcon } from '@heroicons/react/24/outline';

interface FinancialReportProps {
    startDate: string;
    endDate: string;
    canExport?: boolean;
}

interface FinancialData {
    summary: {
        totalOrders: number;
        deliveredOrders: number;
        returnedOrders: number;
        shippedOrders: number;
        pendingOrders: number;
        cancelledOrders: number;
        deliveredRevenue: number;
        returnedValue: number;
        pendingValue: number;
        netRevenue: number;
        returnRate: string;
        deliveryRate: string;
    };
    dailyRevenue: Array<{
        date: string;
        delivered: number;
        returned: number;
        shipped: number;
    }>;
    orders: Array<{
        id: string;
        date: string;
        customer: string;
        product: string;
        quantity: number;
        total: number;
        status: string;
        trackingNumber: string;
    }>;
}

const COLORS = {
    delivered: '#10b981',
    returned: '#ef4444',
    shipped: '#8b5cf6',
    pending: '#f59e0b',
};

export function FinancialReport({ startDate, endDate, canExport }: FinancialReportProps) {
    const [data, setData] = useState<FinancialData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch(
                    `/api/reports/financial?startDate=${startDate}&endDate=${endDate}`
                );
                if (!response.ok) {
                    throw new Error('Failed to fetch financial data');
                }
                const jsonData = await response.json();
                setData(jsonData);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [startDate, endDate]);

    const handleExport = () => {
        const url = `/api/reports/financial/export?startDate=${startDate}&endDate=${endDate}&format=excel`;
        window.open(url, '_blank');
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/20">
                {error}
            </div>
        );
    }

    if (!data) return null;

    const pieData = [
        { name: 'Delivered', value: data.summary.deliveredOrders, color: COLORS.delivered },
        { name: 'Returned', value: data.summary.returnedOrders, color: COLORS.returned },
        { name: 'Shipped', value: data.summary.shippedOrders, color: COLORS.shipped },
        { name: 'Pending', value: data.summary.pendingOrders, color: COLORS.pending },
    ].filter(item => item.value > 0);

    return (
        <div className="space-y-6">
            {canExport && (
                <div className="flex justify-end">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleExport}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export to Excel
                    </motion.button>
                </div>
            )}

            {/* Revenue Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 border border-emerald-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/20">
                            <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Delivered Revenue</div>
                    </div>
                    <div className="mt-3 text-3xl font-bold text-foreground">
                        LKR {data.summary.deliveredRevenue.toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                        {data.summary.deliveredOrders} orders ({data.summary.deliveryRate}%)
                    </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-red-500/10 to-red-500/5 p-6 border border-red-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-red-500/20">
                            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="text-sm font-medium text-red-600 dark:text-red-400">Returned Value</div>
                    </div>
                    <div className="mt-3 text-3xl font-bold text-foreground">
                        LKR {data.summary.returnedValue.toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                        {data.summary.returnedOrders} orders ({data.summary.returnRate}%)
                    </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-6 border border-purple-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-500/20">
                            <TruckIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="text-sm font-medium text-purple-600 dark:text-purple-400">In Transit</div>
                    </div>
                    <div className="mt-3 text-3xl font-bold text-foreground">
                        LKR {data.summary.pendingValue.toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                        {data.summary.shippedOrders} orders shipped
                    </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 p-6 border border-blue-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/20">
                            <ClockIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="text-sm font-medium text-blue-600 dark:text-blue-400">Net Revenue</div>
                    </div>
                    <div className="mt-3 text-3xl font-bold text-foreground">
                        LKR {data.summary.netRevenue.toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                        {data.summary.totalOrders} total orders
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6">Revenue by Status</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.dailyRevenue}>
                                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border opacity-50" />
                                <XAxis
                                    dataKey="date"
                                    stroke="currentColor"
                                    className="text-muted-foreground text-xs"
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="currentColor"
                                    className="text-muted-foreground text-xs"
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        borderColor: 'var(--border)',
                                        borderRadius: '1rem',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    }}
                                    formatter={(value: number) => [`LKR ${value.toLocaleString()}`, '']}
                                />
                                <Legend />
                                <Bar dataKey="delivered" name="Delivered" fill={COLORS.delivered} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="returned" name="Returned" fill={COLORS.returned} radius={[4, 4, 0, 0]} />
                                <Bar dataKey="shipped" name="Shipped" fill={COLORS.shipped} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Order Distribution Pie Chart */}
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6">Order Distribution</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        borderColor: 'var(--border)',
                                        borderRadius: '1rem',
                                    }}
                                    formatter={(value: number) => [`${value} orders`, '']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Recent Orders Table */}
            <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-6">Recent Orders</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Order ID</th>
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.orders.slice(0, 10).map((order) => (
                                <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-3 px-4 font-medium">{order.id}</td>
                                    <td className="py-3 px-4 text-muted-foreground">{order.date}</td>
                                    <td className="py-3 px-4">{order.customer}</td>
                                    <td className="py-3 px-4 text-muted-foreground">{order.product}</td>
                                    <td className="py-3 px-4 text-right font-medium">LKR {order.total.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                            order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-600' :
                                            order.status === 'RETURNED' ? 'bg-red-500/10 text-red-600' :
                                            order.status === 'SHIPPED' ? 'bg-purple-500/10 text-purple-600' :
                                            'bg-yellow-500/10 text-yellow-600'
                                        }`}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
