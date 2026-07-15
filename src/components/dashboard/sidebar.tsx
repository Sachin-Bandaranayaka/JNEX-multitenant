'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Tenant } from '@prisma/client';
import {
    ChartPieIcon,
    ShoppingCartIcon,
    CubeIcon,
    UserIcon,
    BuildingOffice2Icon,
    PaperAirplaneIcon,
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

/* ---- Single top-level nav link ---- */
function NavLink({ href, icon, children, isActive, onClick }: {
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isActive: boolean;
    onClick?: () => void;
}) {
    return (
        <Link href={href} onClick={onClick} className="mx-2 block rounded-md group">
            <div
                className={`flex items-center gap-3 px-3 py-3 rounded-md font-bold text-[15px] transition-colors ${isActive
                    ? 'bg-[#dfe4ec] text-[#40516e] shadow-[inset_3px_0_0_#50617e]'
                    : 'text-[#50617e] hover:bg-[#e5e8ee] hover:text-[#40516e]'
                    }`}
            >
                <span className="flex-shrink-0">{icon}</span>
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
        <div className="mx-2">
            <button
                onClick={onToggle}
                aria-expanded={isExpanded}
                className={`flex items-center gap-3 w-full px-3 py-3 rounded-md font-bold text-[15px] transition-colors ${isExpanded
                    ? 'bg-[#dfe4ec] text-[#40516e] shadow-[inset_3px_0_0_#50617e]'
                    : 'text-[#50617e] hover:bg-[#e5e8ee] hover:text-[#40516e]'
                    }`}
            >
                <span className="flex-shrink-0">{icon}</span>
                <span className="min-w-0 flex-1 text-left whitespace-nowrap">{label}</span>
                <ChevronLeftIcon className={`h-4 w-4 flex-shrink-0 text-[#50617e] transition-transform duration-200 ${isExpanded ? '-rotate-90' : ''}`} />
            </button>
            {isExpanded && (
                <div className="my-1 overflow-hidden rounded-md bg-[#e9ecf1] py-1">
                    {links.map((link) => {
                        const linkActive = pathname === link.href;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={onNavigate}
                                className={`block pl-[44px] pr-3 py-2 text-[13px] font-semibold transition-colors ${linkActive
                                    ? 'bg-[#d9dee7] text-[#40516e]'
                                    : 'text-[#687791] hover:bg-[#dfe4eb] hover:text-[#40516e]'
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
                className={`fixed lg:sticky top-0 h-screen z-50 flex flex-col bg-[#f1f2f5] border-r border-[#dfe3e9] transition-all duration-300 ease-in-out print:hidden w-[232px] ${isMobile
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
                <nav className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
                    {has('VIEW_DASHBOARD') && (
                        <NavLink href="/dashboard" icon={<ChartPieIcon className="h-5 w-5" />}
                            isActive={pathname === '/dashboard'} onClick={closeMobileSidebar}>Dashboard</NavLink>
                    )}

                    <NavGroup
                        icon={<ShoppingCartIcon className="h-5 w-5" />}
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

                    {has('VIEW_INVENTORY') && (
                        <NavGroup
                            icon={<CubeIcon className="h-5 w-5" />}
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

                    {has('VIEW_SHIPPING') && (
                        <NavLink
                            href="/shipping"
                            icon={<PaperAirplaneIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/shipping')}
                            onClick={closeMobileSidebar}
                        >
                            Shipping
                        </NavLink>
                    )}

                    {has('VIEW_LEADS') && (
                        <NavGroup
                            icon={<UserGroupIcon className="h-5 w-5" />}
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

                    {has('VIEW_ORDERS') && (
                        <NavGroup
                            icon={<ShoppingCartIcon className="h-5 w-5" />}
                            label="Orders"
                            isExpanded={expandedGroup === 'Orders'}
                            onToggle={() => handleToggleGroup('Orders')}
                            links={[
                                { href: '/orders', label: 'Pending Orders' },
                                ...(userRole === 'ADMIN' ? [{ href: '/orders/bulk-update', label: 'Import Deliveries' }] : []),
                                { href: '/leads/new', label: 'New Order' },
                                { href: '/search', label: 'Search Orders' },
                            ]}
                            pathname={pathname} onNavigate={closeMobileSidebar}
                        />
                    )}

                    <NavGroup
                        icon={<ArrowUturnLeftIcon className="h-5 w-5" />}
                        label="Return"
                        isExpanded={expandedGroup === 'Return'}
                        onToggle={() => handleToggleGroup('Return')}
                        links={[
                            { href: '/returns/add-return', label: 'Add Return' },
                            { href: '/returns/returned-list', label: 'Return History' },
                        ]}
                        pathname={pathname} onNavigate={closeMobileSidebar}
                    />

                    {has('VIEW_REPORTS') && (
                        <NavLink href="/reports" icon={<BuildingOffice2Icon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/reports')} onClick={closeMobileSidebar}>Reports</NavLink>
                    )}

                    {has('MANAGE_USERS') && (
                        <NavLink href="/users" icon={<UserIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/users')} onClick={closeMobileSidebar}>Staff</NavLink>
                    )}

                    {has('MANAGE_SETTINGS') && (
                        <NavLink href="/settings" icon={<CogIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/settings')} onClick={closeMobileSidebar}>Settings</NavLink>
                    )}

                    {/* Logout */}
                    <button
                        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-md px-3 py-3 font-bold text-[15px] text-[#50617e] transition-colors hover:bg-[#fdeceb] hover:text-[#c9453f]"
                    >
                        <ArrowRightOnRectangleIcon className="h-5 w-5" />
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
