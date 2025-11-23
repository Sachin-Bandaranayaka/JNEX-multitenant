'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LeadsChart } from '@/components/dashboard/leads-chart';
import { DeliveredOrders } from '@/components/dashboard/delivered-orders';
import Link from 'next/link';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { CalendarIcon, FunnelIcon } from '@heroicons/react/24/outline';

interface PeriodStats {
    orders: number;
    revenue: number;
    leads: number;
    conversionRate: number;
}

interface DashboardData {
    daily: PeriodStats;
    weekly: PeriodStats;
    monthly: PeriodStats;
    allTime: {
        totalLeads: number;
        convertedLeads: number;
        conversionRate: number;
    };
    leadsByStatus: Array<{ status: string; count: number; }>;
    noStockCount: number;
    lowStockCount: number;
}

type TimeFilter = 'daily' | 'weekly' | 'monthly';

export function DashboardClient({ initialData, userName }: { initialData: DashboardData; userName?: string | null }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [activeFilter, setActiveFilter] = useState<TimeFilter>('daily');
    const [greeting, setGreeting] = useState('');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Good Morning');
        else if (hour < 17) setGreeting('Good Afternoon');
        else setGreeting('Good Evening');
    }, []);

    const handleRefresh = () => {
        setIsLoading(true);
        router.refresh();
        setLastRefresh(new Date());
        setTimeout(() => setIsLoading(false), 500);
    };

    const currentData = initialData[activeFilter];

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">New report</h1>
                    <p className="text-muted-foreground mt-1">Overview of your store's performance.</p>
                </div>

                <div className="flex items-center gap-3 bg-card p-1 rounded-full border border-border/50 shadow-sm">
                    {(['daily', 'weekly', 'monthly'] as TimeFilter[]).map((filter) => (
                        <button
                            key={filter}
                            onClick={() => setActiveFilter(filter)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${activeFilter === filter
                                    ? 'bg-foreground text-background shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {filter.charAt(0).toUpperCase() + filter.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stock Alerts */}
            {(initialData.lowStockCount > 0 || initialData.noStockCount > 0) && (
                <div className="flex flex-wrap gap-4">
                    {initialData.lowStockCount > 0 && (
                        <Link href="/products" className="flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-600 ring-1 ring-inset ring-orange-500/20 hover:bg-orange-500/20 transition-colors">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                            <span>Low Stock ({initialData.lowStockCount})</span>
                        </Link>
                    )}
                    {initialData.noStockCount > 0 && (
                        <Link href="/inventory" className="flex items-center gap-2 rounded-full bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/20 transition-colors">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            <span>Out of Stock ({initialData.noStockCount})</span>
                        </Link>
                    )}
                </div>
            )}

            {/* Stats Overview */}
            <StatsOverview data={currentData} />

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Leads Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/50"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <FunnelIcon className="h-4 w-4" />
                            </div>
                            <h3 className="font-semibold text-foreground">Lead Conversion</h3>
                        </div>
                        <button className="text-sm font-medium text-muted-foreground hover:text-foreground">
                            Filters
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="p-4 rounded-2xl bg-muted/50">
                            <div className="text-xs text-muted-foreground mb-1">Total</div>
                            <div className="text-xl font-bold">{initialData.allTime.totalLeads}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/50">
                            <div className="text-xs text-muted-foreground mb-1">Converted</div>
                            <div className="text-xl font-bold">{initialData.allTime.convertedLeads}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-muted/50">
                            <div className="text-xs text-muted-foreground mb-1">Rate</div>
                            <div className="text-xl font-bold">{initialData.allTime.conversionRate.toFixed(1)}%</div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <LeadsChart data={initialData.leadsByStatus} />
                    </div>
                </motion.div>

                {/* Delivered Orders (Placeholder for now, or styled list) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/50"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                <CalendarIcon className="h-4 w-4" />
                            </div>
                            <h3 className="font-semibold text-foreground">Recent Deliveries</h3>
                        </div>
                        <Link href="/orders" className="text-sm font-medium text-primary hover:underline">
                            View all
                        </Link>
                    </div>

                    <DeliveredOrders />
                </motion.div>
            </div>
        </div>
    );
}
