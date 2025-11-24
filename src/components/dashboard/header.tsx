'use client';

import { MagnifyingGlassIcon, BellIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { Tenant } from '@prisma/client';
import { ThemeToggle } from '@/components/theme-toggle';
import Image from 'next/image';

export function Header({ tenant, userName, onMenuClick }: { tenant: Tenant; userName?: string | null; onMenuClick?: () => void }) {
    return (
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/40 bg-background/80 px-4 sm:px-6 backdrop-blur-xl transition-all print:hidden">
            <div className="flex items-center gap-4 flex-1">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 -ml-2 text-muted-foreground hover:bg-accent hover:text-foreground rounded-md transition-colors"
                    aria-label="Open menu"
                >
                    <Bars3Icon className="h-6 w-6" />
                </button>

                <div className="relative w-full max-w-md hidden sm:block">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Try searching 'insights'..."
                        className="h-10 w-full rounded-full border-none bg-muted/50 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
                    />
                </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
                <button className="relative rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                    <BellIcon className="h-5 w-5" />
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
                </button>
                <div className="h-8 w-px bg-border/40 hidden sm:block" />
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <div className="flex items-center gap-2 rounded-full border border-border/40 bg-background p-1 pr-3 shadow-sm hover:bg-accent/50 transition-colors cursor-pointer">
                        <div className="relative h-8 w-8 overflow-hidden rounded-full bg-primary/10">
                            {/* Placeholder avatar */}
                            <div className="flex h-full w-full items-center justify-center text-xs font-medium text-primary">
                                {userName ? userName.charAt(0).toUpperCase() : 'U'}
                            </div>
                        </div>
                        <span className="text-sm font-medium text-foreground hidden sm:block">{userName || 'User'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
