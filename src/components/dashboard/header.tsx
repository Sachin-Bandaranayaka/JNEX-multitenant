'use client';

import { Bars3Icon, MagnifyingGlassIcon, ArrowRightOnRectangleIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { Notifications } from './notifications';
import { Tenant } from '@prisma/client';

export function Header({ tenant, userName, onMenuClick }: { tenant: Tenant; userName?: string | null; onMenuClick?: () => void }) {
    const router = useRouter();
    const [q, setQ] = useState('');

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

            {/* Trans Express */}
            <button
                onClick={() => router.push('/shipping')}
                className="hidden sm:flex items-center gap-2 bg-[#4aa3a8] hover:bg-[#3d8a8e] text-white font-semibold text-sm px-3.5 py-2 rounded-md transition-colors"
            >
                <TruckIcon className="h-4 w-4" /> Trans Express
            </button>

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
