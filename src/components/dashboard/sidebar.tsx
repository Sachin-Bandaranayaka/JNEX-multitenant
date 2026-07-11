'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Tenant } from '@prisma/client';
import {
    HomeIcon,
    ShoppingCartIcon,
    ArchiveBoxIcon,
    ClipboardDocumentListIcon,
    UsersIcon,
    ChartBarIcon,
    TruckIcon,
    CogIcon,
    ArrowRightOnRectangleIcon,
    XMarkIcon,
    ChevronLeftIcon,
    ArrowUturnLeftIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    isMobile: boolean;
    tenant: Tenant;
    userRole: string;
    userName?: string | null;
    userPermissions: string[];
}

/* ---- Single nav link (Genzo style: amber left-border when active) ---- */
function NavLink({ href, icon, children, isActive, onClick }: {
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isActive: boolean;
    onClick?: () => void;
}) {
    return (
        <Link href={href} onClick={onClick} className="block group">
            <div
                className={`flex items-center gap-3 px-5 py-3 border-l-[3px] font-semibold text-[14px] transition-colors ${isActive
                    ? 'bg-[#eceef1] text-slate-700 border-[#e89c31]'
                    : 'text-slate-500 border-transparent hover:bg-[#f5f6f8] hover:text-slate-700'
                    }`}
            >
                <span className="flex-shrink-0 opacity-85">{icon}</span>
                <span className="flex-1 whitespace-nowrap">{children}</span>
            </div>
        </Link>
    );
}

/* ---- Collapsible nav group ---- */
function NavGroup({ icon, label, isExpanded, onToggle, links, pathname, onNavigate }: {
    icon: React.ReactNode;
    label: string;
    isExpanded: boolean;
    onToggle: () => void;
    links: { href: string; label: string }[];
    pathname: string;
    onNavigate?: () => void;
}) {
    return (
        <div>
            <button
                onClick={onToggle}
                className={`flex items-center gap-3 w-full px-5 py-3 border-l-[3px] font-semibold text-[14px] transition-colors ${isExpanded
                    ? 'bg-[#eceef1] text-slate-700 border-[#e89c31]'
                    : 'text-slate-500 border-transparent hover:bg-[#f5f6f8] hover:text-slate-700'
                    }`}
            >
                <span className="flex-shrink-0 opacity-85">{icon}</span>
                <span className="flex-1 text-left whitespace-nowrap">{label}</span>
                <ChevronLeftIcon className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? '-rotate-90' : ''}`} />
            </button>
            {isExpanded && (
                <div className="bg-[#fafbfc]">
                    {links.map((link) => {
                        const linkActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={onNavigate}
                                className={`block pl-[51px] pr-5 py-2.5 text-[13px] font-semibold transition-colors ${linkActive
                                    ? 'bg-[#eceef1] text-slate-800'
                                    : 'text-slate-500 hover:bg-[#f0f1f4] hover:text-slate-700'
                                    }`}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function Sidebar({ isOpen, setIsOpen, isMobile, tenant, userRole, userName, userPermissions }: SidebarProps) {
    const pathname = usePathname();
    const closeMobileSidebar = () => { if (isMobile) setIsOpen(false); };
    const has = (perm: string) => userRole === 'ADMIN' || userPermissions.includes(perm);

    const getActiveGroup = (path: string) => {
        if (path.startsWith('/leads')) return 'Leads';
        if (path.startsWith('/orders') || path.startsWith('/search')) return 'Orders';
        if (path.startsWith('/returns')) return 'Return';
        if (path.startsWith('/inventory') || path.startsWith('/products')) return 'Stock';
        if (path.startsWith('/store')) return 'Products Purchase';
        return null;
    };

    const [expandedGroup, setExpandedGroup] = useState<string | null>(() => getActiveGroup(pathname));

    useEffect(() => {
        setExpandedGroup(getActiveGroup(pathname));
    }, [pathname]);

    const handleToggleGroup = (label: string) => {
        setExpandedGroup(prev => prev === label ? null : label);
    };

    return (
        <>
            {isMobile && isOpen && (
                <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
            )}

            <aside
                className={`fixed lg:sticky top-0 h-screen z-50 flex flex-col bg-white border-r border-[#e3e6ea] transition-all duration-300 ease-in-out print:hidden w-[232px] ${isMobile
                    ? isOpen ? 'translate-x-0' : '-translate-x-full'
                    : 'translate-x-0'
                    }`}
            >
                {/* Brand */}
                <div className="flex items-center justify-between pt-4 px-5 pb-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {tenant.logoUrl && (
                            <div className="relative h-8 w-8 flex-shrink-0">
                                <Image src={tenant.logoUrl} alt="Logo" fill className="object-contain" sizes="32px" />
                            </div>
                        )}
                    </div>
                    {isMobile && (
                        <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-500">
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    )}
                </div>

                {/* Profile block */}
                <div className="px-5 pb-3.5 border-b border-[#e3e6ea]">
                    <div className="font-bold text-slate-500 text-[13px] truncate">
                        {tenant.businessName || 'Srilanka'} 🇱🇰
                    </div>
                    <div className="font-bold text-slate-700 mt-2 text-[15px] truncate">{userName || 'User'}</div>
                    <div className="text-[#aab2bf] text-[11px] tracking-widest uppercase">{userRole}</div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
                    {/* --- Ordered to follow the daily workflow: Leads -> Orders -> Shipping -> Return --- */}
                    {has('VIEW_DASHBOARD') && (
                        <NavLink href="/dashboard" icon={<HomeIcon className="h-[18px] w-[18px]" />}
                            isActive={pathname === '/dashboard'} onClick={closeMobileSidebar}>Dashboard</NavLink>
                    )}

                    {/* 1. Leads — import & call */}
                    {has('VIEW_LEADS') && (
                        <NavGroup
                            icon={<UserGroupIcon className="h-[18px] w-[18px]" />}
                            label="Leads"
                            isExpanded={expandedGroup === 'Leads'}
                            onToggle={() => handleToggleGroup('Leads')}
                            links={[
                                { href: '/leads/import', label: 'Import Lead' },
                                { href: '/leads', label: 'Lead List' },
                                { href: '/leads/remind-leads', label: 'Remind Leads' },
                            ]}
                            pathname={pathname} onNavigate={closeMobileSidebar}
                        />
                    )}

                    {/* 2. Orders — confirm, print invoice & mark delivered */}
                    {has('VIEW_ORDERS') && (
                        <NavGroup
                            icon={<ClipboardDocumentListIcon className="h-[18px] w-[18px]" />}
                            label="Orders"
                            isExpanded={expandedGroup === 'Orders'}
                            onToggle={() => handleToggleGroup('Orders')}
                            links={[
                                { href: '/orders', label: 'Order Queue' },
                                ...(userRole === 'ADMIN' ? [{ href: '/orders/bulk-update', label: 'Import Deliveries' }] : []),
                                { href: '/leads/new', label: 'New Order' },
                                { href: '/search', label: 'Search Orders' },
                            ]}
                            pathname={pathname} onNavigate={closeMobileSidebar}
                        />
                    )}

                    {/* 3. Shipping */}
                    {has('VIEW_SHIPPING') && (
                        <NavLink
                            href="/shipping"
                            icon={<TruckIcon className="h-[18px] w-[18px]" />}
                            isActive={pathname.startsWith('/shipping')}
                            onClick={closeMobileSidebar}
                        >
                            Shipping
                        </NavLink>
                    )}

                    {/* 4. Return */}
                    <NavGroup
                        icon={<ArrowUturnLeftIcon className="h-[18px] w-[18px]" />}
                        label="Return"
                        isExpanded={expandedGroup === 'Return'}
                        onToggle={() => handleToggleGroup('Return')}
                        links={[
                            { href: '/returns/add-return', label: 'Add Return' },
                            { href: '/returns/returned-list', label: 'Return History' },
                        ]}
                        pathname={pathname} onNavigate={closeMobileSidebar}
                    />

                    {/* --- Supporting / inventory / admin --- */}
                    {has('VIEW_INVENTORY') && (
                        <NavGroup
                            icon={<ArchiveBoxIcon className="h-[18px] w-[18px]" />}
                            label="Stock"
                            isExpanded={expandedGroup === 'Stock'}
                            onToggle={() => handleToggleGroup('Stock')}
                            links={[
                                { href: '/inventory', label: 'Stock List' },
                                { href: '/products', label: 'Products' },
                            ]}
                            pathname={pathname} onNavigate={closeMobileSidebar}
                        />
                    )}

                    {/* Products Purchase */}
                    <NavGroup
                        icon={<ShoppingCartIcon className="h-[18px] w-[18px]" />}
                        label="Products Purchase"
                        isExpanded={expandedGroup === 'Products Purchase'}
                        onToggle={() => handleToggleGroup('Products Purchase')}
                        links={[
                            { href: '/store', label: 'Buy Products' },
                            { href: '/store/purchases', label: 'My Invoices' },
                            { href: '/store/cart', label: 'Cart' },
                        ]}
                        pathname={pathname} onNavigate={closeMobileSidebar}
                    />

                    {has('VIEW_REPORTS') && (
                        <NavLink href="/reports" icon={<ChartBarIcon className="h-[18px] w-[18px]" />}
                            isActive={pathname.startsWith('/reports')} onClick={closeMobileSidebar}>Reports</NavLink>
                    )}

                    {has('MANAGE_USERS') && (
                        <NavLink href="/users" icon={<UsersIcon className="h-[18px] w-[18px]" />}
                            isActive={pathname.startsWith('/users')} onClick={closeMobileSidebar}>Staff</NavLink>
                    )}

                    {has('MANAGE_SETTINGS') && (
                        <NavLink href="/settings" icon={<CogIcon className="h-[18px] w-[18px]" />}
                            isActive={pathname.startsWith('/settings')} onClick={closeMobileSidebar}>Settings</NavLink>
                    )}

                    {/* Logout */}
                    <button
                        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                        className="flex items-center gap-3 w-full px-5 py-3 border-l-[3px] border-transparent font-semibold text-[14px] text-slate-500 hover:bg-[#fdeceb] hover:text-[#c9453f] transition-colors"
                    >
                        <ArrowRightOnRectangleIcon className="h-[18px] w-[18px]" />
                        <span>Log out</span>
                    </button>
                </nav>

                <div className="px-5 py-3 border-t border-[#e3e6ea] text-[11px] text-[#aab2bf]">
                    Copyright J-nex IT © {new Date().getFullYear()}
                </div>
            </aside>
        </>
    );
}
