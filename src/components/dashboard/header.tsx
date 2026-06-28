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

    const couriers = [
        { id: 'FARDA_EXPRESS', name: 'Farda Express' },
        { id: 'TRANS_EXPRESS', name: 'Trans Express' },
        { id: 'ROYAL_EXPRESS', name: 'Royal Express' },
        { id: 'SL_POST', name: 'SL Post' },
    ];

    const currentCourierName = couriers.find(c => c.id === defaultCourier)?.name || 'Select Courier';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.courier-dropdown-container')) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const submitSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    };

    return (
        <header className="sticky top-0 z-30 flex h-[62px] items-center gap-4 bg-[#3c4452] px-4 sm:px-6 print:hidden">
            <button
                onClick={onMenuClick}
                className="lg:hidden p-2 -ml-2 text-gray-300 hover:text-white rounded-md transition-colors"
                aria-label="Open menu"
            >
                <Bars3Icon className="h-6 w-6" />
            </button>

            {/* Search */}
            <form onSubmit={submitSearch} className="flex items-center flex-1 max-w-[420px] gap-2">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 hidden sm:block" />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search Phone No / Name"
                    className="w-full bg-transparent border-none text-gray-200 placeholder:text-gray-400 focus:outline-none text-sm py-2"
                />
            </form>

            <div className="flex-1" />

            {/* Courier Selector Dropdown */}
            <div className="relative courier-dropdown-container hidden sm:block">
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 bg-[#4aa3a8] hover:bg-[#3d8a8e] text-white font-semibold text-sm px-3.5 py-2 rounded-md transition-colors"
                >
                    <TruckIcon className="h-4 w-4" />
                    <span>{currentCourierName}</span>
                    <svg className={`h-4 w-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {showDropdown && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black/5 focus:outline-none z-50 py-1">
                        {couriers.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => handleSelectCourier(c.id)}
                                className={`flex w-full items-center px-4 py-2 text-sm transition-colors text-left ${
                                    defaultCourier === c.id
                                        ? 'bg-[#eceef1] text-slate-800 font-semibold'
                                        : 'text-slate-600 hover:bg-[#f5f6f8] hover:text-slate-900'
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
                <div className="h-7 w-7 rounded-full bg-[#e89c31] flex items-center justify-center text-xs font-bold text-white">
                    {userName ? userName.charAt(0).toUpperCase() : 'U'}
                </div>
                <span>{userName || 'Profile'}</span>
            </div>

            <Notifications />
            <span className="text-lg">🇱🇰</span>

            <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="flex items-center gap-1.5 text-gray-200 hover:text-white font-semibold text-sm"
            >
                <ArrowRightOnRectangleIcon className="h-5 w-5" /> <span className="hidden sm:inline">Log out</span>
            </button>
        </header>
    );
}
