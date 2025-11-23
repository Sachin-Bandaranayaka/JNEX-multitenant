'use client';

import { useState, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface LeadReportProps {
    startDate: string;
    endDate: string;
    totalLeads: number;
    canExport?: boolean;
}

interface LeadData {
    dailyLeads: Array<{ date: string; count: number; converted: number; }>;
    leadsByStatus: Array<{ status: string; count: number; }>;
    conversionRate: number;
    averageResponseTime: number;
}

const STATUS_COLORS = { NEW: '#6366F1', CONTACTED: '#8B5CF6', QUALIFIED: '#EC4899', PROPOSAL: '#F43F5E', CONVERTED: '#10B981', LOST: '#6B7280' };

export function LeadReport({ startDate, endDate, totalLeads, canExport }: LeadReportProps) {
    const [data, setData] = useState<LeadData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch(
                    `/api/reports/leads?startDate=${startDate}&endDate=${endDate}`
                );
                if (!response.ok) { throw new Error('Failed to fetch lead data'); }
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
        const url = `/api/reports/leads/export?startDate=${startDate}&endDate=${endDate}&format=${format}`;
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
                    <div className="text-sm font-medium text-muted-foreground">Total Leads</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{totalLeads}</div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Conversion Rate</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{((data?.conversionRate || 0) * 100).toFixed(1)}%</div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <div className="text-sm font-medium text-muted-foreground">Avg. Response Time</div>
                    <div className="mt-2 text-3xl font-bold text-foreground">{(data?.averageResponseTime || 0).toFixed(1)} hours</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6">Daily Leads</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data?.dailyLeads || []}>
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
                                <Line type="monotone" dataKey="count" name="Total Leads" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} />
                                <Line type="monotone" dataKey="converted" name="Converted" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="rounded-3xl bg-card p-6 border border-border shadow-sm">
                    <h3 className="text-lg font-bold text-foreground mb-6">Leads by Status</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data?.leadsByStatus || []}
                                    dataKey="count"
                                    nameKey="status"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {(data?.leadsByStatus || []).map((entry) => (
                                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || '#6B7280'} stroke="var(--card)" strokeWidth={2} />
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