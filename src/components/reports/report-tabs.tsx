'use client';

import { useState } from 'react';
import { User } from 'next-auth';
import { motion } from 'framer-motion';
import { SalesReport } from './sales-report';
import { ProductReport } from './product-report';
import { LeadReport } from './lead-report';
import { ShippingReport } from './shipping-report';

interface ReportTabsProps {
    user: User;
    initialData: {
        totalOrders: number;
        totalProducts: number;
        totalLeads: number;
        totalShipments: number;
        shippingStats: Record<string, number>;
    };
}

type TabType = 'sales' | 'products' | 'leads' | 'shipping';
// --- NEW: Define a type for the time filter buttons ---
type TimeFilterType = 'daily' | 'weekly' | 'monthly' | 'custom';

export function ReportTabs({ user, initialData }: ReportTabsProps) {
    const [activeTab, setActiveTab] = useState<TabType>('sales');
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });
    
    // --- NEW: Add state to track the active time filter ---
    const [activeFilter, setActiveFilter] = useState<TimeFilterType>('monthly');

    const canExport = user?.role === 'ADMIN' || user?.permissions?.includes('EXPORT_REPORTS');
    
    // --- NEW: Function to handle clicks on the Daily, Weekly, Monthly buttons ---
    const handleTimeFilterClick = (filter: TimeFilterType) => {
        if (filter === 'custom') return;

        setActiveFilter(filter);
        const today = new Date();
        let newStartDate = new Date();

        if (filter === 'daily') {
            newStartDate = today;
        } else if (filter === 'weekly') {
            newStartDate.setDate(today.getDate() - 6); // Today plus the previous 6 days
        } else if (filter === 'monthly') {
            newStartDate.setMonth(today.getMonth() - 1);
        }
        
        setDateRange({
            startDate: newStartDate.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0],
        });
    };

    const tabs: { id: TabType; name: string; icon: JSX.Element }[] = [
        {
            id: 'sales',
            name: 'Sales Report',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
        },
        {
            id: 'products',
            name: 'Product Report',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            ),
        },
        {
            id: 'leads',
            name: 'Lead Report',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
        },
        {
            id: 'shipping',
            name: 'Shipping Report',
            icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
            ),
        },
    ];
    return (
        <div className="p-6 bg-gray-800 text-white">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                {/* Date Range Selector */}
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <label htmlFor="startDate" className="text-sm font-medium text-gray-400">From</label>
                        <input
                            type="date" id="startDate" value={dateRange.startDate}
                            onChange={(e) => {
                                setDateRange(prev => ({ ...prev, startDate: e.target.value }));
                                setActiveFilter('custom'); // Set filter to custom when manually changing
                            }}
                            className="rounded-md border-gray-700 bg-gray-700 text-gray-100 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <label htmlFor="endDate" className="text-sm font-medium text-gray-400">To</label>
                        <input
                            type="date" id="endDate" value={dateRange.endDate}
                            onChange={(e) => {
                                setDateRange(prev => ({ ...prev, endDate: e.target.value }));
                                setActiveFilter('custom'); // Set filter to custom when manually changing
                            }}
                            className="rounded-md border-gray-700 bg-gray-700 text-gray-100 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* --- NEW: Daily, Weekly, Monthly Buttons --- */}
                <div className="flex items-center space-x-2 p-1 bg-gray-900 rounded-lg">
                    <button
                        onClick={() => handleTimeFilterClick('daily')}
                        className={`px-4 py-2 sm:px-3 sm:py-1 text-sm sm:text-base font-medium rounded-md transition-colors touch-manipulation min-h-[44px] sm:min-h-[36px] ${activeFilter === 'daily' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                        Daily
                    </button>
                    <button
                        onClick={() => handleTimeFilterClick('weekly')}
                        className={`px-4 py-2 sm:px-3 sm:py-1 text-sm sm:text-base font-medium rounded-md transition-colors touch-manipulation min-h-[44px] sm:min-h-[36px] ${activeFilter === 'weekly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                        Weekly
                    </button>
                    <button
                        onClick={() => handleTimeFilterClick('monthly')}
                        className={`px-4 py-2 sm:px-3 sm:py-1 text-sm sm:text-base font-medium rounded-md transition-colors touch-manipulation min-h-[44px] sm:min-h-[36px] ${activeFilter === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                    >
                        Monthly
                    </button>
                </div>
            </div>
            
            <div className="border-b border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'border-indigo-500 text-indigo-400'
                                    : 'border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-300'
                            }`}
                        >
                            {tab.icon}
                            <span className="ml-2">{tab.name}</span>
                        </button>
                    ))}
                </nav>
            </div>

            <motion.div
                key={`${activeTab}-${dateRange.startDate}-${dateRange.endDate}`} // Re-trigger animation on date change
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-6"
            >
                {/* Report components remain the same, they will re-fetch data automatically */}
                {activeTab === 'sales' && (
                    <SalesReport
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                        totalOrders={initialData.totalOrders}
                        canExport={canExport}
                    />
                )}
                {activeTab === 'products' && (
                    <ProductReport
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                        totalProducts={initialData.totalProducts}
                        canExport={canExport}
                    />
                )}
                {activeTab === 'leads' && (
                    <LeadReport
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                        totalLeads={initialData.totalLeads}
                        canExport={canExport}
                    />
                )}
                {activeTab === 'shipping' && (
                    <ShippingReport
                        startDate={dateRange.startDate}
                        endDate={dateRange.endDate}
                        totalShipments={initialData.totalShipments}
                        shippingStats={initialData.shippingStats}
                        canExport={canExport}
                    />
                )}
            </motion.div>
        </div>
    );
}