'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Tenant } from '@prisma/client';
import {
    HomeIcon,
    ShoppingBagIcon,
    ArchiveBoxIcon,
    ClipboardDocumentListIcon,
    UsersIcon,
    ChartBarIcon,
    MagnifyingGlassIcon,
    TruckIcon,
    CogIcon,
    ArrowRightOnRectangleIcon,
    XMarkIcon,
    BuildingStorefrontIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    isMobile: boolean;
    tenant: Tenant;
    userRole: string;
    userPermissions: string[];
}

function NavLink({ href, icon, children, isActive, onClick, isOpen, isMobile }: {
    href: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    isActive: boolean;
    onClick?: () => void;
    isOpen: boolean;
    isMobile: boolean;
}) {
    const showText = isOpen || isMobile;

    return (
        <Link href={href} onClick={onClick} className="block group">
            <div
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
            >
                <div className={`flex-shrink-0 transition-colors ${isActive ? 'text-primary-foreground' : 'group-hover:text-foreground'}`}>
                    {icon}
                </div>

                <span
                    className={`font-medium whitespace-nowrap transition-all duration-300 origin-left ${showText ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 w-0 overflow-hidden'
                        }`}
                >
                    {children}
                </span>

                {/* Tooltip for collapsed state on desktop */}
                {!showText && !isMobile && (
                    <div className="absolute left-16 z-50 hidden group-hover:block">
                        <div className="bg-popover text-popover-foreground text-xs font-medium px-2 py-1 rounded shadow-md border border-border whitespace-nowrap">
                            {children}
                        </div>
                    </div>
                )}
            </div>
        </Link>
    );
}

export function Sidebar({ isOpen, setIsOpen, isMobile, tenant, userRole, userPermissions }: SidebarProps) {
    const pathname = usePathname();

    const closeMobileSidebar = () => {
        if (isMobile) {
            setIsOpen(false);
        }
    };

    const showText = isOpen || isMobile;

    return (
        <>
            {/* Mobile Overlay */}
            {isMobile && isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside
                className={`fixed lg:sticky top-0 h-screen z-50 flex flex-col bg-card border-r border-border transition-all duration-300 ease-in-out print:hidden ${isMobile
                    ? isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72'
                    : isOpen ? 'w-72' : 'w-20'
                    }`}
            >
                {/* Header / Logo Area */}
                <div className={`flex items-center h-20 px-6 border-b border-border/40 ${!showText && !isMobile ? 'justify-center px-2' : 'justify-between'}`}>
                    {(showText || isMobile) ? (
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="relative h-10 w-10 flex-shrink-0 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                                {tenant.logoUrl ? (
                                    <Image
                                        src={tenant.logoUrl}
                                        alt="Logo"
                                        fill
                                        className="object-contain p-1"
                                        sizes="40px"
                                    />
                                ) : (
                                    <Image
                                        src="/IMAGES/logo.svg"
                                        alt="Logo"
                                        fill
                                        className="object-contain p-1"
                                        sizes="40px"
                                    />
                                )}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <h1 className="text-sm font-bold text-foreground truncate leading-tight">
                                    {tenant.businessName || 'Dashboard'}
                                </h1>
                                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                    Enterprise
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative h-10 w-10 flex-shrink-0 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                            {tenant.logoUrl ? (
                                <Image
                                    src={tenant.logoUrl}
                                    alt="Logo"
                                    fill
                                    className="object-contain p-1"
                                    sizes="40px"
                                />
                            ) : (
                                <Image
                                    src="/IMAGES/logo.svg"
                                    alt="Logo"
                                    fill
                                    className="object-contain p-1"
                                    sizes="40px"
                                />
                            )}
                        </div>
                    )}

                    {isMobile && (
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    )}
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 custom-scrollbar">
                    {(userRole === 'ADMIN' || userPermissions.includes('VIEW_DASHBOARD')) && (
                        <NavLink
                            href="/dashboard"
                            icon={<HomeIcon className="h-5 w-5" />}
                            isActive={pathname === '/dashboard'}
                            onClick={closeMobileSidebar}
                            isOpen={isOpen}
                            isMobile={isMobile}
                        >
                            Dashboard
                        </NavLink>
                    )}

                    {(userRole === 'ADMIN' || userPermissions.includes('VIEW_PRODUCTS')) && (
                        <NavLink
                            href="/products"
                            icon={<ShoppingBagIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/products')}
                            onClick={closeMobileSidebar}
                            isOpen={isOpen}
                            isMobile={isMobile}
                        >
                            Products
                        </NavLink>
                    )}

                    {(userRole === 'ADMIN' || userPermissions.includes('VIEW_INVENTORY')) && (
                        <NavLink
                            href="/inventory"
                            icon={<ArchiveBoxIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/inventory')}
                            onClick={closeMobileSidebar}
                            isOpen={isOpen}
                            isMobile={isMobile}
                        >
                            Inventory
                        </NavLink>
                    )}

                    {(userRole === 'ADMIN' || userPermissions.includes('VIEW_ORDERS')) && (
                        <NavLink
                            href="/orders"
                            icon={<ClipboardDocumentListIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/orders')}
                            onClick={closeMobileSidebar}
                            isOpen={isOpen}
                            isMobile={isMobile}
                        >
                            Orders
                        </NavLink>
                    )}

                    {(userRole === 'ADMIN' || userPermissions.includes('VIEW_LEADS')) && (
                        <NavLink
                            href="/leads"
                            icon={<UsersIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/leads')}
                            onClick={closeMobileSidebar}
                            isOpen={isOpen}
                            isMobile={isMobile}
                        >
                            Leads
                        </NavLink>
                    )}

                    {(userRole === 'ADMIN' || userPermissions.includes('VIEW_SEARCH')) && (
                        <NavLink
                            href="/search"
                            icon={<MagnifyingGlassIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/search')}
                            onClick={closeMobileSidebar}
                            isOpen={isOpen}
                            isMobile={isMobile}
                        >
                            Search
                        </NavLink>
                    )}

                    {(userRole === 'ADMIN' || userPermissions.includes('VIEW_SHIPPING')) && (
                        <NavLink
                            href="/shipping"
                            icon={<TruckIcon className="h-5 w-5" />}
                            isActive={pathname.startsWith('/shipping')}
                            onClick={closeMobileSidebar}
                            isOpen={isOpen}
                            isMobile={isMobile}
                        >
                            Shipping
                        </NavLink>
                    )}

                    <NavLink
                        href="/store"
                        icon={<BuildingStorefrontIcon className="h-5 w-5" />}
                        isActive={pathname.startsWith('/store')}
                        onClick={closeMobileSidebar}
                        isOpen={isOpen}
                        isMobile={isMobile}
                    >
                        Store
                    </NavLink>

                    {/* Management Section */}
                    {(userRole === 'ADMIN' || userPermissions.includes('VIEW_REPORTS') || userPermissions.includes('MANAGE_USERS') || userPermissions.includes('MANAGE_SETTINGS')) && (
                        <>
                            <div className={`mt-8 mb-2 px-3 ${!showText && !isMobile ? 'hidden' : 'block'}`}>
                                <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                                    Management
                                </span>
                            </div>
                            {/* Divider for collapsed state */}
                            {!showText && !isMobile && <div className="my-4 border-t border-border/40 mx-2" />}

                            {(userRole === 'ADMIN' || userPermissions.includes('VIEW_REPORTS')) && (
                                <NavLink
                                    href="/reports"
                                    icon={<ChartBarIcon className="h-5 w-5" />}
                                    isActive={pathname.startsWith('/reports')}
                                    onClick={closeMobileSidebar}
                                    isOpen={isOpen}
                                    isMobile={isMobile}
                                >
                                    Reports
                                </NavLink>
                            )}

                            {(userRole === 'ADMIN' || userPermissions.includes('MANAGE_USERS')) && (
                                <NavLink
                                    href="/users"
                                    icon={<UsersIcon className="h-5 w-5" />}
                                    isActive={pathname.startsWith('/users')}
                                    onClick={closeMobileSidebar}
                                    isOpen={isOpen}
                                    isMobile={isMobile}
                                >
                                    Users
                                </NavLink>
                            )}

                            {(userRole === 'ADMIN' || userPermissions.includes('MANAGE_SETTINGS')) && (
                                <NavLink
                                    href="/settings"
                                    icon={<CogIcon className="h-5 w-5" />}
                                    isActive={pathname.startsWith('/settings')}
                                    onClick={closeMobileSidebar}
                                    isOpen={isOpen}
                                    isMobile={isMobile}
                                >
                                    Settings
                                </NavLink>
                            )}
                        </>
                    )}
                </nav>

                {/* Footer / Logout */}
                <div className="p-4 border-t border-border/40">
                    <button
                        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                        className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group ${!showText && !isMobile ? 'justify-center' : ''
                            }`}
                    >
                        <ArrowRightOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
                        {(showText || isMobile) && (
                            <span className="font-medium whitespace-nowrap">Logout</span>
                        )}
                        {/* Tooltip for collapsed state */}
                        {!showText && !isMobile && (
                            <div className="absolute left-16 z-50 hidden group-hover:block">
                                <div className="bg-popover text-popover-foreground text-xs font-medium px-2 py-1 rounded shadow-md border border-border whitespace-nowrap">
                                    Logout
                                </div>
                            </div>
                        )}
                    </button>
                </div>
            </aside>
        </>
    );
}
