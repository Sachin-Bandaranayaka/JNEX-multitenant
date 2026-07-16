'use client';

import { Bars3Icon, MagnifyingGlassIcon, ArrowRightOnRectangleIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import { Notifications } from './notifications';
import { Tenant } from '@prisma/client';
import { toast } from 'sonner';

export function Header({ tenant, userName, onMenuClick }: { tenant: Tenant; userName?: string | null; onMenuClick?: () => void }) {
    const router = useRouter();
    const [q, setQ] = useState('');
    const [defaultCourier, setDefaultCourier] = useState<string>(tenant.defaultShippingProvider || 'TRANS_EXPRESS');
    const [showDropdown, setShowDropdown] = useState(false);
    
    // Auto-suggestions search states
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const couriers = [
        { id: 'FARDA_EXPRESS', name: 'Farda Express' },
        { id: 'TRANS_EXPRESS', name: 'Trans Express' },
        { id: 'ROYAL_EXPRESS', name: 'Royal Express' },
        { id: 'SL_POST', name: 'SL Post' },
    ];

    const currentCourierName = couriers.find(c => c.id === defaultCourier)?.name || 'Select Courier';

    // Click outside handler for dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.courier-dropdown-container')) {
                setShowDropdown(false);
            }
            if (!target.closest('.header-search-container')) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search auto-suggestions
    useEffect(() => {
        if (q.trim().length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const delayDebounce = setTimeout(async () => {
            setLoadingSuggestions(true);
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
                if (response.ok) {
                    const data = await response.json();
                    setSuggestions(data);
                    setShowSuggestions(true);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingSuggestions(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [q]);

    const handleSelectCourier = async (courierId: string) => {
        try {
            const response = await fetch('/api/settings/default-courier', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultShippingProvider: courierId }),
            });

            if (!response.ok) throw new Error('Failed to update default courier');

            setDefaultCourier(courierId);
            toast.success(`Default courier updated to ${couriers.find(c => c.id === courierId)?.name}`);
            router.refresh();
        } catch (e) {
            toast.error('Failed to update default courier');
        } finally {
            setShowDropdown(false);
        }
    };

    return (
        <header className="sticky top-0 z-30 flex h-[62px] items-center gap-4 border-b border-white/10 bg-[#17181c] px-4 shadow-sm sm:px-6 print:hidden">
            <button
                onClick={onMenuClick}
                className="lg:hidden p-2 -ml-2 text-gray-300 hover:text-white rounded-md transition-colors"
                aria-label="Open menu"
            >
                <Bars3Icon className="h-6 w-6" />
            </button>

            {/* Search Bar with Auto Suggestions Overlay */}
            <div className="header-search-container relative z-50 min-w-0 max-w-[420px] flex-1">
                <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2">
                    <MagnifyingGlassIcon className="h-5 w-5 text-red-300 hidden sm:block" />
                    <label htmlFor="header-order-search" className="sr-only">Search orders by phone number or customer name</label>
                    <input
                        id="header-order-search"
                        aria-label="Search orders by phone number or customer name"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onFocus={() => { if (q.trim().length >= 2) setShowSuggestions(true); }}
                        placeholder="Search Phone No / Name"
                        className="w-full border-none bg-transparent py-2 text-sm text-white placeholder:text-gray-400 focus:outline-none focus:ring-0"
                    />
                </form>

                {showSuggestions && (
                    <div className="absolute left-0 mt-2 w-full max-h-96 overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-black/5 focus:outline-none z-50 p-2 divide-y divide-slate-100 border border-slate-100">
                        {loadingSuggestions ? (
                            <div className="flex items-center justify-center py-6 text-xs text-slate-500 gap-2">
                                <svg className="animate-spin h-4 w-4 text-[#e10600]" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span>Searching...</span>
                            </div>
                        ) : suggestions.length === 0 ? (
                            <div className="text-center py-6 text-xs text-slate-500">
                                No matching orders found
                            </div>
                        ) : (
                            suggestions.map((customer, idx) => (
                                <div key={idx} className="p-2 space-y-1 text-slate-800">
                                    <div className="font-semibold text-xs text-[#b80505] flex justify-between">
                                        <span>{customer.customerName}</span>
                                        <span className="text-slate-400 font-normal">{customer.customerPhone}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate" title={customer.customerAddress}>
                                        {customer.customerAddress}
                                    </div>
                                    <div className="space-y-1 mt-1 pl-2 border-l-2 border-slate-100">
                                        {customer.orders.map((order: any) => (
                                            <button
                                                key={order.id}
                                                onClick={() => {
                                                    setShowSuggestions(false);
                                                    setQ('');
                                                    router.push(`/orders/${order.id}`);
                                                }}
                                                className="flex items-center justify-between w-full text-left text-xs p-1.5 rounded hover:bg-slate-50 transition-colors"
                                            >
                                                <span className="font-medium text-slate-700">
                                                    #{order.id.slice(0, 8)} - {order.product?.name || 'Product'}
                                                </span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                                    order.status === 'CONFIRMED'
                                                        ? 'bg-slate-100 text-slate-800'
                                                        : order.status === 'PENDING'
                                                        ? 'bg-red-50 text-[#b80505]'
                                                        : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1" />

            {/* Courier Selector Dropdown */}
            <div className="courier-dropdown-container relative">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 rounded-md bg-[#e10600] p-2 text-sm font-semibold text-white transition-colors hover:bg-[#b80505] focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 focus:ring-offset-[#17181c] sm:px-3.5 sm:py-2"
                    aria-label={`Default courier: ${currentCourierName}. Change default courier`}
                    aria-expanded={showDropdown}
                >
                    <TruckIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{currentCourierName}</span>
                    <svg className={`hidden h-4 w-4 transition-transform duration-200 sm:block ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {showDropdown && (
                    <div className="absolute right-0 z-50 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
                        {couriers.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => handleSelectCourier(c.id)}
                                className={`flex w-full items-center px-4 py-2 text-sm transition-colors text-left ${
                                    defaultCourier === c.id
                                        ? 'bg-[#fff5f5] text-[#b80505] font-semibold'
                                        : 'text-slate-600 hover:bg-[#fff5f5] hover:text-slate-900'
                                }`}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Profile */}
            <div className="hidden sm:flex items-center gap-2 text-gray-200 font-semibold text-sm cursor-pointer hover:text-white">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e10600] text-xs font-bold text-white ring-2 ring-white/20">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span>{userName || 'Profile'}</span>
            </div>

            <Notifications />
            <span className="hidden text-lg sm:inline">🇱🇰</span>

            <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="flex items-center gap-1.5 text-gray-200 hover:text-white font-semibold text-sm"
            >
                <ArrowRightOnRectangleIcon className="h-5 w-5" /> <span className="hidden sm:inline">Log out</span>
            </button>
        </header>
    );
}
