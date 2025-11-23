// 

'use client';

import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { ShippingProvider } from '@prisma/client';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

// FIX: Add canExport to the props interface
interface ShippingReportProps {
    startDate: string;
    endDate: string;
    totalShipments: number;
    shippingStats: Record<string, number>;
    canExport?: boolean;
}

interface ShippingData {
    dailyShipments: Array<{ date: string; count: number; }>;
    providerPerformance: Array<{ provider: string; shipments: number; }>;
    onTimeDeliveryRate: number;
    averageDeliveryTime: number;
}

export function ShippingReport({ startDate, endDate, canExport, shippingStats, totalShipments }: ShippingReportProps) {
    const [data, setData] = useState<ShippingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [provider, setProvider] = useState<ShippingProvider | 'ALL'>('ALL');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                let url = `/api/reports/shipping?startDate=${startDate}&endDate=${endDate}`;
                if (provider !== 'ALL') {
                    url += `&provider=${provider}`;
                }
                const response = await fetch(url);
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.details || 'Failed to fetch shipping data');
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
    }, [startDate, endDate, provider]);

    // FIX: Simplified export handler
    const handleExport = (format: 'excel' | 'pdf') => {
        let url = `/api/reports/shipping/export?startDate=${startDate}&endDate=${endDate}&format=${format}`;
        if (provider !== 'ALL') {
            url += `&provider=${provider}`;
        }
        window.open(url, '_blank');
    };

    if (isLoading) {
        return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div></div>;
    }

    if (error) {
        return <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive ring-1 ring-destructive/20">{error}</div>;
    }

    // This guard clause is still useful in case the API returns an empty response
    if (!data) {
        return <div className="text-center py-12 text-muted-foreground">No shipping data available for this period.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <label htmlFor="provider-select" className="block text-sm font-medium text-muted-foreground mb-1">Filter by Provider</label>
                    <select
                        id="provider-select"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as ShippingProvider | 'ALL')}
                        className="block w-full sm:w-auto pl-3 pr-10 py-2 text-sm border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-full"
                    >
                        <option value="ALL">All Providers</option>
                        {Object.keys(shippingStats).map(p => (
                            <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>

                {/* FIX: Conditionally render export buttons */}
                {canExport && (
                    <div className="flex items-center space-x-3">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleExport('excel')}
                            className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Excel
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleExport('pdf')}
                            className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            PDF
                        </motion.button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Total Shipments</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{totalShipments}</div>
                </div>
                {/* FIX: Added safety checks to prevent crashes */}
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">On-Time Delivery Rate</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{(data?.onTimeDeliveryRate ?? 0 * 100).toFixed(1)}%</div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Avg. Delivery Time</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{(data?.averageDeliveryTime ?? 0).toFixed(1)} days</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6">Daily Shipments</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.dailyShipments}>
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
                                    allowDecimals={false}
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
                                />
                                <Legend />
                                <Line type="monotone" dataKey="count" name="Shipments" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6">Provider Performance</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.providerPerformance} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border opacity-50" />
                                <XAxis type="number" stroke="currentColor" className="text-muted-foreground text-xs" tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="provider" stroke="currentColor" className="text-muted-foreground text-xs" tickLine={false} axisLine={false} width={100} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        borderColor: 'var(--border)',
                                        borderRadius: '1rem',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                        color: 'var(--foreground)'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="shipments" name="Total Shipments" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}