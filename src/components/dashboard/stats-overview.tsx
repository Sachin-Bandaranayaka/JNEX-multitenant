'use client';

import { ArrowUpIcon, ArrowDownIcon, EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface PeriodStats {
    orders: number;
    revenue: number;
    leads: number;
    conversionRate: number;
}

interface StatsOverviewProps {
    data: PeriodStats;
    previousData?: PeriodStats; // Optional for comparison
}

export function StatsOverview({ data }: StatsOverviewProps) {
    // Mocking percentage changes for now as we don't have previous period data passed explicitly yet
    // In a real scenario, we would calculate this from previousData
    const revenueChange = 7.9;
    const revenueUp = true;

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Main Revenue Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="col-span-1 lg:col-span-7 rounded-3xl bg-card p-8 shadow-sm ring-1 ring-border/50"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-muted-foreground">Revenue</h3>
                    <button className="text-muted-foreground hover:text-foreground">
                        <EllipsisHorizontalIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex items-baseline gap-4">
                    <h2 className="text-5xl font-bold text-foreground tracking-tight">
                        LKR {data.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </h2>
                    <div className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${revenueUp ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                        {revenueUp ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
                        {revenueChange}%
                    </div>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                    vs prev. period
                </div>

                {/* Placeholder for a sparkline or mini-chart */}
                <div className="mt-8 h-16 w-full bg-gradient-to-r from-primary/5 via-primary/10 to-transparent rounded-lg relative overflow-hidden">
                    <div className="absolute inset-0 flex items-end justify-between px-2 pb-2 opacity-30">
                        {[40, 60, 45, 70, 50, 80, 65, 85, 75, 90, 60, 95].map((h, i) => (
                            <div key={i} className="w-4 bg-primary rounded-t-sm" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Secondary Stats Grid */}
            <div className="col-span-1 lg:col-span-5 grid grid-cols-2 gap-4">
                <StatsCard
                    title="Orders"
                    value={data.orders.toLocaleString()}
                    change={12}
                    isUp={true}
                    delay={0.1}
                />
                <StatsCard
                    title="Leads"
                    value={data.leads.toLocaleString()}
                    change={5}
                    isUp={false}
                    delay={0.2}
                />
                <StatsCard
                    title="Conversion"
                    value={`${data.conversionRate.toFixed(1)}%`}
                    change={2.1}
                    isUp={true}
                    delay={0.3}
                />
                <StatsCard
                    title="Avg. Order"
                    value={data.orders > 0 ? `LKR ${(data.revenue / data.orders).toFixed(0)}` : '0'}
                    change={0.5}
                    isUp={true}
                    delay={0.4}
                />
            </div>
        </div>
    );
}

function StatsCard({ title, value, change, isUp, delay }: { title: string; value: string; change: number; isUp: boolean; delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay }}
            className="flex flex-col justify-between rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border/50 hover:shadow-md transition-shadow"
        >
            <div className="flex justify-between items-start">
                <span className="text-sm font-medium text-muted-foreground">{title}</span>
                <div className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
                    {isUp ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
                    {change}%
                </div>
            </div>
            <div className="mt-4">
                <span className="text-2xl font-bold text-foreground">{value}</span>
            </div>
        </motion.div>
    )
}
