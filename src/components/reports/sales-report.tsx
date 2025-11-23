// src/components/reports/sales-report.tsx

'use client';

import { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface SalesReportProps {
    startDate: string;
    endDate: string;
    totalOrders: number;
    canExport?: boolean;
}

interface SalesData {
    dailyRevenue: Array<{
        date: string;
        revenue: number;
    }>;
    totalRevenue: number;
    averageOrderValue: number;
}

export function SalesReport({ startDate, endDate, totalOrders, canExport }: SalesReportProps) {
    const [data, setData] = useState<SalesData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch(
                    `/api/reports/sales?startDate=${startDate}&endDate=${endDate}`
                );
                if (!response.ok) {
                    throw new Error('Failed to fetch sales data');
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

    const handleExport = (format: 'excel' | 'csv' | 'pdf') => {
        const url = `/api/reports/sales/export?startDate=${startDate}&endDate=${endDate}&format=${format}`;
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

    if (!data) {
        return null;
    }

    return (
        <div className="space-y-6">
            {canExport && (
                <div className="flex justify-end space-x-3">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleExport('excel')}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export Excel
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleExport('pdf')}
                        className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Export PDF
                    </motion.button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Total Orders</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{totalOrders}</div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">
                        LKR {data.totalRevenue.toLocaleString()}
                    </div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Average Order Value</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">
                        LKR {data.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>

            {/* Revenue Chart */}
            <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-6">Daily Revenue</h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.dailyRevenue}>
                            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border opacity-50" />
                            <XAxis
                                dataKey="date"
                                stroke="currentColor"
                                className="text-muted-foreground text-xs"
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="currentColor"
                                className="text-muted-foreground text-xs"
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `LKR ${value.toLocaleString()}`}
                                dx={-10}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--card)',
                                    borderColor: 'var(--border)',
                                    borderRadius: '1rem',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    color: 'var(--foreground)'
                                }}
                                itemStyle={{ color: 'var(--primary)' }}
                                formatter={(value: number) => [`LKR ${value.toLocaleString()}`, 'Revenue']}
                            />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                stroke="var(--primary)"
                                strokeWidth={3}
                                dot={{ r: 4, fill: 'var(--background)', strokeWidth: 2 }}
                                activeDot={{ r: 6, fill: 'var(--primary)' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}