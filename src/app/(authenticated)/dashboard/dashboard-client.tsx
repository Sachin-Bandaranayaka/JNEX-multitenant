'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LeadsChart } from '@/components/dashboard/leads-chart';
import Link from 'next/link';

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

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(new Date());
    const [activeFilter, setActiveFilter] = useState<TimeFilter>('daily');

    const handleRefresh = () => {
        setIsLoading(true);
        router.refresh();
        setLastRefresh(new Date());
        setTimeout(() => setIsLoading(false), 500);
    };

    const currentData = initialData[activeFilter];

    return (
        <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-white leading-tight">Dashboard</h1>
            </div>

            <div>
                {/* Mobile-first responsive header */}
                <div className="space-y-4 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-medium text-gray-200 leading-tight">Overview</h2>
                        
                        {/* Time filter buttons - full width on mobile */}
                        <div className="flex items-center space-x-1 p-1 bg-gray-900 rounded-lg w-full sm:w-auto">
                            {(['daily', 'weekly', 'monthly'] as TimeFilter[]).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setActiveFilter(filter)}
                                    className={`flex-1 sm:flex-none px-3 py-2 text-sm sm:text-base font-medium rounded-md transition-colors touch-manipulation ${
                                        activeFilter === filter
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-gray-400 hover:bg-gray-700/50 active:bg-gray-600/50'
                                    }`}
                                >
                                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Stock alerts - stack on mobile */}
                    {(initialData.lowStockCount > 0 || initialData.noStockCount > 0) && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                            {initialData.lowStockCount > 0 && (
                                <Link href="/products" className="flex items-center justify-center sm:justify-start space-x-2 rounded-lg bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-300 ring-1 ring-inset ring-orange-500/20 hover:bg-orange-500/20 active:bg-orange-500/30 transition-colors touch-manipulation">
                                    <span>Low Stock</span>
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-xs">
                                        {initialData.lowStockCount}
                                    </span>
                                </Link>
                            )}
                            {initialData.noStockCount > 0 && (
                                <Link href="/inventory" className="flex items-center justify-center sm:justify-start space-x-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/20 active:bg-red-500/30 transition-colors touch-manipulation">
                                    <span>No Stock</span>
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-xs">
                                        {initialData.noStockCount}
                                    </span>
                                </Link>
                            )}
                        </div>
                    )}
                </div>
                {/* Responsive stats grid */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <StatCard title="Orders" value={currentData.orders.toLocaleString()} delay={0.1} />
                    <StatCard title="Revenue" value={`LKR ${currentData.revenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} delay={0.2} />
                    <StatCard title="Leads" value={currentData.leads.toLocaleString()} delay={0.3} />
                    <StatCard title="Conversion Rate" value={`${currentData.conversionRate.toFixed(1)}%`} delay={0.4} />
                </div>
            </div>

            {/* Lead conversion section with mobile optimization */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="rounded-lg bg-gray-800 p-4 sm:p-6 ring-1 ring-white/10">
                <h2 className="text-lg font-medium text-white mb-4">Lead Conversion</h2>
                
                {/* Mobile-optimized conversion stats */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 mb-6">
                    <div className="rounded-lg bg-gray-700/50 p-3 sm:p-4 ring-1 ring-gray-700">
                        <div className="text-xs sm:text-sm text-gray-400">Total Leads</div>
                        <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold text-white">{initialData.allTime.totalLeads}</div>
                    </div>
                    <div className="rounded-lg bg-gray-700/50 p-3 sm:p-4 ring-1 ring-gray-700">
                        <div className="text-xs sm:text-sm text-gray-400">Converted Leads</div>
                        <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold text-white">{initialData.allTime.convertedLeads}</div>
                    </div>
                    <div className="rounded-lg bg-gray-700/50 p-3 sm:p-4 ring-1 ring-gray-700">
                        <div className="text-xs sm:text-sm text-gray-400">Conversion Rate</div>
                        <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-semibold text-white">{(initialData.allTime.conversionRate).toFixed(1)}%</div>
                    </div>
                </div>
                
                {/* Chart container with mobile optimization */}
                <div className="mt-4 sm:mt-6 overflow-x-auto">
                    <LeadsChart data={initialData.leadsByStatus} />
                </div>
            </motion.div>
        </div>
    );
}

function StatCard({ title, value, delay }: { title: string; value: string; delay: number }) {
    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="rounded-lg bg-gray-800 p-3 sm:p-4 ring-1 ring-white/10">
            <div className="text-xs sm:text-sm font-medium text-gray-400 truncate">{title}</div>
            <div className="mt-1 text-lg sm:text-2xl font-semibold text-white break-words">{value}</div>
        </motion.div>
    );
}
