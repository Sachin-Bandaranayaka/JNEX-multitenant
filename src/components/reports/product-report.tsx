'use client';

import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface ProductReportProps {
    startDate: string;
    endDate: string;
    totalProducts: number;
    canExport?: boolean;
}

interface ProductData {
    topProducts: Array<{ name: string; sales: number; revenue: number; }>;
    stockLevels: Array<{ name: string; stock: number; lowStockAlert: number; }>;
    totalRevenue: number;
    averageStock: number;
}

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F59E0B'];

export function ProductReport({ startDate, endDate, totalProducts, canExport }: ProductReportProps) {
    const [data, setData] = useState<ProductData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch(
                    `/api/reports/products?startDate=${startDate}&endDate=${endDate}`
                );
                if (!response.ok) { throw new Error('Failed to fetch product data'); }
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

    const handleExport = (format: 'excel' | 'pdf') => {
        const url = `/api/reports/products/export?startDate=${startDate}&endDate=${endDate}&format=${format}`;
        window.open(url, '_blank');
    };

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div></div>;
    }

    if (error) {
        return <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/20">{error}</div>;
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

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Total Products</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{totalProducts}</div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">LKR {(data?.totalRevenue || 0).toLocaleString()}</div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Average Stock Level</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{(data?.averageStock || 0).toLocaleString()}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6">Top Products by Revenue</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.topProducts || []} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border opacity-50" />
                                <XAxis
                                    dataKey="name"
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
                                    tickFormatter={(value) => `LKR ${value / 1000}k`}
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
                                    formatter={(value: number) => `LKR ${value.toLocaleString()}`}
                                />
                                <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6">Stock Levels</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.stockLevels || []}
                                    dataKey="stock"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {(data?.stockLevels || []).map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="var(--card)" strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        borderColor: 'var(--border)',
                                        borderRadius: '1rem',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        color: 'var(--foreground)'
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}