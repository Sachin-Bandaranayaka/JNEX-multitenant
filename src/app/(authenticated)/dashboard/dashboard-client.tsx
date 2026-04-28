'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LeadsChart } from '@/components/dashboard/leads-chart';
import { DeliveredOrders } from '@/components/dashboard/delivered-orders';
import Link from 'next/link';
import { StatsOverview } from '@/components/dashboard/stats-overview';
import { CalendarIcon, FunnelIcon, BellAlertIcon, UserIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';

interface PeriodChanges {
    orders: number | null;
    revenue: number | null;
    leads: number | null;
    conversionRate: number | null;
    avgOrderValue: number | null;
}

interface PeriodStats {
    orders: number;
    revenue: number;
    leads: number;
    conversionRate: number;
    avgOrderValue: number;
    changes: PeriodChanges;
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
    reminders: {
        overdue: Array<{
            id: string;
            csvData: any;
            reminderDate: string;
            reminderNote: string | null;
            product: { name: string };
            assignedTo: { name: string | null } | null;
        }>;
        today: Array<{
            id: string;
            csvData: any;
            reminderDate: string;
            reminderNote: string | null;
            product: { name: string };
            assignedTo: { name: string | null } | null;
        }>;
        upcoming: Array<{
            id: string;
            csvData: any;
            reminderDate: string;
            reminderNote: string | null;
            product: { name: string };
            assignedTo: { name: string | null } | null;
        }>;
    };
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

            {/* 🚨 REMINDER ALERTS — Big, Bold, Impossible to Miss */}
            {(initialData.reminders.overdue.length > 0 || initialData.reminders.today.length > 0 || initialData.reminders.upcoming.length > 0) && (
                <div className="space-y-4">
                    {/* OVERDUE — Flashing Red Alert */}
                    {initialData.reminders.overdue.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-2xl overflow-hidden shadow-2xl ring-2 ring-red-400 animate-pulse"
                            style={{ animationDuration: '2s' }}
                        >
                            <div className="bg-gradient-to-r from-red-600 via-red-500 to-rose-500 p-5">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                                            <BellAlertIcon className="h-8 w-8 text-white animate-bounce" />
                                        </div>
                                        <span className="absolute -top-1 -right-1 flex h-5 w-5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75"></span>
                                            <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-yellow-400 text-red-800 text-[10px] font-black">{initialData.reminders.overdue.length}</span>
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-white font-black text-xl tracking-tight">⚠️ OVERDUE REMINDERS</h2>
                                        <p className="text-red-100 text-sm mt-0.5">These leads are past their follow-up date — take action now!</p>
                                    </div>
                                    <Link href="/leads/remind-leads" className="px-5 py-2.5 bg-white text-red-600 rounded-xl text-sm font-black hover:bg-red-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 whitespace-nowrap">
                                        View All →
                                    </Link>
                                </div>
                            </div>
                            <div className="bg-red-50 dark:bg-red-950/50 divide-y divide-red-200 dark:divide-red-800">
                                {initialData.reminders.overdue.slice(0, 5).map((r, i) => (
                                    <Link key={r.id} href={`/leads/${r.id}?edit=true`}
                                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors group">
                                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-red-900 dark:text-red-200 text-sm">{(r.csvData as any)?.name || 'Unknown'}</span>
                                                {(r.csvData as any)?.phone && (
                                                    <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-0.5">
                                                        <PhoneIcon className="h-3 w-3" />{(r.csvData as any).phone}
                                                    </span>
                                                )}
                                            </div>
                                            {r.reminderNote && (
                                                <p className="text-xs text-red-600 dark:text-red-300 mt-0.5 italic">💬 &quot;{r.reminderNote}&quot;</p>
                                            )}
                                        </div>
                                        <span className="hidden sm:inline-flex px-2.5 py-1 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded-lg text-xs font-semibold">{r.product.name}</span>
                                        {r.assignedTo?.name && (
                                            <span className="hidden md:inline-flex px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs">{r.assignedTo.name}</span>
                                        )}
                                        <div className="flex-shrink-0 text-right">
                                            <span className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-bold">{format(new Date(r.reminderDate), 'MMM d')}</span>
                                        </div>
                                        <span className="text-red-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all">→</span>
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* TODAY — Pulsing Orange Alert */}
                    {initialData.reminders.today.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-2xl overflow-hidden shadow-xl ring-2 ring-orange-300"
                        >
                            <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 p-5">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm animate-pulse">
                                            <BellAlertIcon className="h-8 w-8 text-white" />
                                        </div>
                                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-orange-600 text-[10px] font-black shadow">{initialData.reminders.today.length}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-white font-black text-xl tracking-tight">🔔 TODAY&apos;S REMINDERS</h2>
                                        <p className="text-orange-100 text-sm mt-0.5">Follow up on these leads before end of day.</p>
                                    </div>
                                    <Link href="/leads/remind-leads" className="px-5 py-2.5 bg-white text-orange-600 rounded-xl text-sm font-black hover:bg-orange-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 whitespace-nowrap">
                                        View All →
                                    </Link>
                                </div>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-950/50 divide-y divide-orange-200 dark:divide-orange-800">
                                {initialData.reminders.today.map((r, i) => (
                                    <Link key={r.id} href={`/leads/${r.id}?edit=true`}
                                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors group">
                                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-orange-900 dark:text-orange-200 text-sm">{(r.csvData as any)?.name || 'Unknown'}</span>
                                                {(r.csvData as any)?.phone && (
                                                    <span className="text-xs text-orange-500 dark:text-orange-400 flex items-center gap-0.5">
                                                        <PhoneIcon className="h-3 w-3" />{(r.csvData as any).phone}
                                                    </span>
                                                )}
                                            </div>
                                            {r.reminderNote && (
                                                <p className="text-xs text-orange-600 dark:text-orange-300 mt-0.5 italic">💬 &quot;{r.reminderNote}&quot;</p>
                                            )}
                                        </div>
                                        <span className="hidden sm:inline-flex px-2.5 py-1 bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 rounded-lg text-xs font-semibold">{r.product.name}</span>
                                        {r.assignedTo?.name && (
                                            <span className="hidden md:inline-flex px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded text-xs">{r.assignedTo.name}</span>
                                        )}
                                        <span className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-xs font-bold flex-shrink-0">Today</span>
                                        <span className="text-orange-400 group-hover:text-orange-600 group-hover:translate-x-1 transition-all">→</span>
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* UPCOMING — Bold Blue Alert with Full Details */}
                    {initialData.reminders.upcoming.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="rounded-2xl overflow-hidden shadow-xl ring-2 ring-blue-300"
                        >
                            <div className="bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 p-5">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                                            <CalendarIcon className="h-8 w-8 text-white" />
                                        </div>
                                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-blue-600 text-[10px] font-black shadow">{initialData.reminders.upcoming.length}</span>
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-white font-black text-xl tracking-tight">📅 UPCOMING REMINDERS</h2>
                                        <p className="text-blue-100 text-sm mt-0.5">Scheduled follow-ups coming soon — stay ahead of your pipeline.</p>
                                    </div>
                                    <Link href="/leads/remind-leads" className="px-5 py-2.5 bg-white text-blue-600 rounded-xl text-sm font-black hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl hover:scale-105 whitespace-nowrap">
                                        View All →
                                    </Link>
                                </div>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/50 divide-y divide-blue-200 dark:divide-blue-800">
                                {initialData.reminders.upcoming.map((r, i) => (
                                    <Link key={r.id} href={`/leads/${r.id}?edit=true`}
                                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors group">
                                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-blue-900 dark:text-blue-200 text-sm">{(r.csvData as any)?.name || 'Unknown'}</span>
                                                {(r.csvData as any)?.phone && (
                                                    <span className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-0.5">
                                                        <PhoneIcon className="h-3 w-3" />{(r.csvData as any).phone}
                                                    </span>
                                                )}
                                            </div>
                                            {r.reminderNote && (
                                                <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5 italic">💬 &quot;{r.reminderNote}&quot;</p>
                                            )}
                                        </div>
                                        <span className="hidden sm:inline-flex px-2.5 py-1 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-lg text-xs font-semibold">{r.product.name}</span>
                                        {r.assignedTo?.name && (
                                            <span className="hidden md:inline-flex px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">{r.assignedTo.name}</span>
                                        )}
                                        <div className="flex-shrink-0 text-right">
                                            <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">{format(new Date(r.reminderDate), 'MMM d')}</span>
                                        </div>
                                        <span className="text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all">→</span>
                                    </Link>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {/* Stats Overview removed per user request */}

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
