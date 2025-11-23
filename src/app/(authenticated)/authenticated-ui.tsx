'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useSessionStatus } from '@/hooks/use-session-status';
import { ThemeToggle } from '@/components/theme-toggle';
import { Tenant } from '@prisma/client';
import {
  HomeIcon, ShoppingBagIcon, ArchiveBoxIcon, ClipboardDocumentListIcon,
  UsersIcon, ChartBarIcon, MagnifyingGlassIcon, TruckIcon, CogIcon,
  ArrowRightOnRectangleIcon, Bars3Icon, XMarkIcon
} from '@heroicons/react/24/outline';
import { Header } from '@/components/dashboard/header';

function NavLink({ href, icon, children, isActive, onClick }: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive: boolean;
  onClick?: () => void;
}) {
  const showText = typeof children === 'string' && children.length > 0;
  return (
    <Link href={href} onClick={onClick}>
      <div
        className={`flex items-center space-x-3 rounded-xl px-4 py-3 transition-all duration-200 touch-manipulation group ${isActive
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
      >
        <div className={isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}>
          {icon}
        </div>
        {showText && <span className="font-medium">{children}</span>}
      </div>
    </Link>
  );
}

export default function AuthenticatedUI({ children, tenant }: { children: React.ReactNode; tenant: Tenant; }) {
  useSessionStatus();
  const { data: session, status } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed on mobile
  const [isMobile, setIsMobile] = useState(false);

  const pathname = usePathname();

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true); // Always open on desktop
      } else {
        setIsSidebarOpen(false); // Closed by default on mobile
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && isSidebarOpen) {
        const sidebar = document.getElementById('mobile-sidebar');
        if (sidebar && !sidebar.contains(event.target as Node)) {
          setIsSidebarOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isSidebarOpen]);

  const closeMobileSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  if (status === 'loading' || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-b-4 border-primary"></div>
      </div>
    );
  }

  const userRole = session.user.role;
  const userPermissions = session.user.permissions || [];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        id="mobile-sidebar"
        className={`print:hidden flex-shrink-0 flex flex-col transition-all duration-300 bg-card border-r border-border/40 z-50
          ${isMobile
            ? `fixed top-0 left-0 h-full shadow-2xl ${isSidebarOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full'}`
            : `sticky top-0 h-screen ${isSidebarOpen ? 'w-72' : 'w-20'}`
          }`}
      >
        {/* Desktop header */}
        <div className={`flex items-center p-6 mb-2 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {isSidebarOpen && (
            <div className="flex items-center gap-3">
              {tenant.logoUrl ? (
                <Image
                  src={tenant.logoUrl}
                  alt="Logo"
                  width={40}
                  height={40}
                  className="rounded-xl object-contain"
                  priority
                />
              ) : (
                <Image
                  src="/IMAGES/logo.svg"
                  alt="Logo"
                  width={40}
                  height={40}
                  className="rounded-xl object-contain"
                  priority
                />
              )}
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-foreground truncate leading-none">
                  {tenant.businessName || 'Dashboard'}
                </h1>
                <span className="text-xs text-muted-foreground mt-1">Enterprise</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors lg:hidden"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-grow space-y-1 px-4 overflow-y-auto scrollbar-thin">
          {(userRole === 'ADMIN' || userPermissions.includes('VIEW_DASHBOARD')) &&
            <NavLink
              href="/dashboard"
              icon={<HomeIcon className="h-6 w-6" />}
              isActive={pathname === '/dashboard'}
              onClick={closeMobileSidebar}
            >
              {(isSidebarOpen || isMobile) && 'Dashboard'}
            </NavLink>
          }
          {(userRole === 'ADMIN' || userPermissions.includes('VIEW_PRODUCTS')) &&
            <NavLink
              href="/products"
              icon={<ShoppingBagIcon className="h-6 w-6" />}
              isActive={pathname.startsWith('/products')}
              onClick={closeMobileSidebar}
            >
              {(isSidebarOpen || isMobile) && 'Products'}
            </NavLink>
          }
          {(userRole === 'ADMIN' || userPermissions.includes('VIEW_INVENTORY')) &&
            <NavLink
              href="/inventory"
              icon={<ArchiveBoxIcon className="h-6 w-6" />}
              isActive={pathname.startsWith('/inventory')}
              onClick={closeMobileSidebar}
            >
              {(isSidebarOpen || isMobile) && 'Inventory'}
            </NavLink>
          }
          {(userRole === 'ADMIN' || userPermissions.includes('VIEW_ORDERS')) &&
            <NavLink
              href="/orders"
              icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
              isActive={pathname.startsWith('/orders')}
              onClick={closeMobileSidebar}
            >
              {(isSidebarOpen || isMobile) && 'Orders'}
            </NavLink>
          }
          {(userRole === 'ADMIN' || userPermissions.includes('VIEW_LEADS')) &&
            <NavLink
              href="/leads"
              icon={<UsersIcon className="h-6 w-6" />}
              isActive={pathname.startsWith('/leads')}
              onClick={closeMobileSidebar}
            >
              {(isSidebarOpen || isMobile) && 'Leads'}
            </NavLink>
          }
          {(userRole === 'ADMIN' || userPermissions.includes('VIEW_SEARCH')) &&
            <NavLink
              href="/search"
              icon={<MagnifyingGlassIcon className="h-6 w-6" />}
              isActive={pathname.startsWith('/search')}
              onClick={closeMobileSidebar}
            >
              {(isSidebarOpen || isMobile) && 'Search'}
            </NavLink>
          }
          {(userRole === 'ADMIN' || userPermissions.includes('VIEW_SHIPPING')) &&
            <NavLink
              href="/shipping"
              icon={<TruckIcon className="h-6 w-6" />}
              isActive={pathname.startsWith('/shipping')}
              onClick={closeMobileSidebar}
            >
              {(isSidebarOpen || isMobile) && 'Shipping'}
            </NavLink>
          }

          {(userRole === 'ADMIN' || userPermissions.includes('VIEW_REPORTS') || userPermissions.includes('MANAGE_USERS') || userPermissions.includes('MANAGE_SETTINGS')) && (
            <>
              <div className="mt-8 mb-4 px-4">
                {(isSidebarOpen || isMobile) && (
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Management
                  </span>
                )}
              </div>
              {(userRole === 'ADMIN' || userPermissions.includes('VIEW_REPORTS')) &&
                <NavLink
                  href="/reports"
                  icon={<ChartBarIcon className="h-6 w-6" />}
                  isActive={pathname.startsWith('/reports')}
                  onClick={closeMobileSidebar}
                >
                  {(isSidebarOpen || isMobile) && 'Reports'}
                </NavLink>
              }
              {(userRole === 'ADMIN' || userPermissions.includes('MANAGE_USERS')) &&
                <NavLink
                  href="/users"
                  icon={<UsersIcon className="h-6 w-6" />}
                  isActive={pathname.startsWith('/users')}
                  onClick={closeMobileSidebar}
                >
                  {(isSidebarOpen || isMobile) && 'Users'}
                </NavLink>
              }
              {(userRole === 'ADMIN' || userPermissions.includes('MANAGE_SETTINGS')) &&
                <NavLink
                  href="/settings"
                  icon={<CogIcon className="h-6 w-6" />}
                  isActive={pathname.startsWith('/settings')}
                  onClick={closeMobileSidebar}
                >
                  {(isSidebarOpen || isMobile) && 'Settings'}
                </NavLink>
              }
            </>
          )}
        </nav>
        <div className="p-4 mt-auto border-t border-border/40 space-y-2">
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className={`flex w-full items-center space-x-3 rounded-xl px-4 py-3 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 active:bg-red-100 touch-manipulation ${!isSidebarOpen && !isMobile && 'justify-center'
              }`}
          >
            <ArrowRightOnRectangleIcon className="h-6 w-6" />
            {(isSidebarOpen || isMobile) && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header
          tenant={tenant}
          userName={session.user.name}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background/50 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
