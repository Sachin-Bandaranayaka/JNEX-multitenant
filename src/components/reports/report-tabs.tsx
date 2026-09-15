'use client';

import { useState, useEffect } from 'react';
import { User } from 'next-auth';
import { motion } from 'framer-motion';
import { SalesReport } from './sales-report';
import { ProductReport } from './product-report';
import { LeadReport } from './lead-report';
import { ShippingReport } from './shipping-report';
import { FinancialReport } from './financial-report';
import {
    ChartBarIcon,
    CubeIcon,
    UsersIcon,
    TruckIcon,
    BanknotesIcon
} from '@heroicons/react/24/outline';

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

type TabType = 'sales' | 'products' | 'leads' | 'shipping' | 'financial';
type TimeFilterType = 'daily' | 'weekly' | 'monthly' | 'custom';

export function ReportTabs({ user, initialData }: ReportTabsProps) {
    const [productId,setProductId] = useState(''); const [staffId,setStaffId] = useState(''); const [courier,setCourier] = useState('');
    const [filterOptions,setFilterOptions] = useState<{products:Array<{id:string,name:string,code:string}>,staff:Array<{id:string,name:string|null}>}>({products:[],staff:[]});
    const [optionsFailed,setOptionsFailed] = useState(false); const [optionsRetry,setOptionsRetry] = useState(0);
    useEffect(()=>{const controller=new AbortController();setOptionsFailed(false);fetch('/api/reports/filter-options',{signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json();if(!controller.signal.aborted)setFilterOptions(data);}).catch(()=>{if(!controller.signal.aborted)setOptionsFailed(true);});return()=>controller.abort();},[optionsRetry]);
    const filterQuery = new URLSearchParams({productId,staffId,courier}).toString();
    const [activeTab, setActiveTab] = useState<TabType>('financial');
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    const [activeFilter, setActiveFilter] = useState<TimeFilterType>('monthly');

    const canExport = user?.role === 'ADMIN' || user?.permissions?.includes('EXPORT_REPORTS');

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
            id: 'financial',
            name: 'Financial',
            icon: <BanknotesIcon className="h-5 w-5" />,
        },
        {
            id: 'sales',
            name: 'Sales Report',
            icon: <ChartBarIcon className="h-5 w-5" />,
        },
        {
            id: 'products',
            name: 'Product Report',
            icon: <CubeIcon className="h-5 w-5" />,
        },
        {
            id: 'leads',
            name: 'Lead Report',
            icon: <UsersIcon className="h-5 w-5" />,
        },
        {
            id: 'shipping',
            name: 'Shipping Report',
            icon: <TruckIcon className="h-5 w-5" />,
        },
    ];

    return (
        <div className="bg-card text-card-foreground">
            <div className="p-6 border-b border-border">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                    {/* Tabs */}
                    <div className="flex space-x-1 bg-muted/50 p-1 rounded-full overflow-x-auto max-w-full">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center whitespace-nowrap px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === tab.id
                                        ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                    }`}
                            >
                                {tab.icon}
                                <span className="ml-2">{tab.name}</span>
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                        {/* Time Filters */}
                        <div className="flex items-center space-x-1 p-1 bg-muted/50 rounded-full w-full sm:w-auto justify-center">
                            {(['daily', 'weekly', 'monthly'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => handleTimeFilterClick(filter)}
                                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 capitalize ${activeFilter === filter
                                            ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                                        }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>

                        {/* Date Range Selector */}
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-center bg-muted/30 px-3 py-1.5 rounded-full border border-border">
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => {
                                    setDateRange(prev => ({ ...prev, startDate: e.target.value }));
                                    setActiveFilter('custom');
                                }}
                                className="bg-transparent text-sm text-foreground focus:outline-none font-medium"
                            />
                            <span className="text-muted-foreground text-sm">to</span>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => {
                                    setDateRange(prev => ({ ...prev, endDate: e.target.value }));
                                    setActiveFilter('custom');
                                }}
                                className="bg-transparent text-sm text-foreground focus:outline-none font-medium"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <section aria-label="Report filters" className="mx-6 mt-4 rounded-xl border border-border p-4"><div className="grid gap-3 sm:grid-cols-3"><label className="text-xs text-muted-foreground">Product<select value={productId} onChange={e=>setProductId(e.target.value)} className="mt-1 block w-full rounded-md border-border bg-background text-sm"><option value="">All products</option>{filterOptions.products.map(product=><option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</select></label><label className="text-xs text-muted-foreground">Assigned staff<select value={staffId} onChange={e=>setStaffId(e.target.value)} className="mt-1 block w-full rounded-md border-border bg-background text-sm"><option value="">All staff</option>{filterOptions.staff.map(person=><option key={person.id} value={person.id}>{person.name || 'Unnamed staff'}</option>)}</select></label><label className="text-xs text-muted-foreground">Courier<select value={courier} onChange={e=>setCourier(e.target.value)} className="mt-1 block w-full rounded-md border-border bg-background text-sm"><option value="">All couriers</option>{['TRANS_EXPRESS','FARDA_EXPRESS','SL_POST','ROYAL_EXPRESS'].map(value=><option key={value} value={value}>{value.replace(/_/g,' ')}{value==='ROYAL_EXPRESS'?' (historical)':''}</option>)}</select></label></div><div className="mt-3 flex flex-wrap justify-between gap-3"><p className="text-xs text-muted-foreground">Filters apply to report metrics, charts and exports. Courier filters on leads include only leads with a matching order.</p><button onClick={()=>{setProductId('');setStaffId('');setCourier('');}} className="text-sm text-primary">Clear report filters</button></div>{optionsFailed && <p role="alert" className="mt-2 text-sm text-destructive">Filter options could not load. <button onClick={()=>setOptionsRetry(value=>value+1)} className="underline">Retry</button></p>}</section>
            <div className="p-6">
                <motion.div
                    key={`${activeTab}-${dateRange.startDate}-${dateRange.endDate}-${filterQuery}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeTab === 'financial' && (
                        <FinancialReport
                            filterQuery={filterQuery}
                            startDate={dateRange.startDate}
                            endDate={dateRange.endDate}
                            canExport={canExport}
                        />
                    )}
                    {activeTab === 'sales' && (
                        <SalesReport
                            filterQuery={filterQuery}
                            startDate={dateRange.startDate}
                            endDate={dateRange.endDate}
                            totalOrders={initialData.totalOrders}
                            canExport={canExport}
                        />
                    )}
                    {activeTab === 'products' && (
                        <ProductReport
                            filterQuery={filterQuery}
                            startDate={dateRange.startDate}
                            endDate={dateRange.endDate}
                            totalProducts={initialData.totalProducts}
                            canExport={canExport}
                        />
                    )}
                    {activeTab === 'leads' && (
                        <LeadReport
                            filterQuery={filterQuery}
                            startDate={dateRange.startDate}
                            endDate={dateRange.endDate}
                            totalLeads={initialData.totalLeads}
                            canExport={canExport}
                        />
                    )}
                    {activeTab === 'shipping' && (
                        <ShippingReport
                            filterQuery={filterQuery}
                            startDate={dateRange.startDate}
                            endDate={dateRange.endDate}
                            totalShipments={initialData.totalShipments}
                            shippingStats={initialData.shippingStats}
                            canExport={canExport}
                        />
                    )}
                </motion.div>
            </div>
        </div>
    );
}