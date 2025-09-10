'use client';

import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useSessionStatus } from '@/hooks/use-session-status';
import { Tenant } from '@prisma/client';
import {
  HomeIcon, ShoppingBagIcon, ArchiveBoxIcon, ClipboardDocumentListIcon,
  UsersIcon, ChartBarIcon, MagnifyingGlassIcon, TruckIcon, CogIcon,
  ArrowRightOnRectangleIcon, Bars3Icon, XMarkIcon
} from '@heroicons/react/24/outline';

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
        className={`flex items-center space-x-4 rounded-lg px-4 py-3 transition-colors touch-manipulation ${
          isActive
            ? 'bg-indigo-600/20 text-indigo-300'
            : 'text-gray-400 hover:bg-gray-700/50 hover:text-white active:bg-gray-600/50'
        }`}
      >
        {icon}
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
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="h-16 w-16 animate-spin rounded-full border-t-4 border-b-4 border-indigo-500"></div>
      </div>
    );
  }

  const userRole = session.user.role;
  const userPermissions = session.user.permissions || [];

  return (
    <div className="flex min-h-screen bg-gray-900">
      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant.logoUrl && (
              <Image 
                src={tenant.logoUrl} 
                alt="Logo" 
                width={28} 
                height={28} 
                className="rounded-md object-contain w-7 h-7 sm:w-8 sm:h-8" 
                priority
                sizes="(max-width: 640px) 28px, 32px"
              />
            )}
            <h1 className="text-lg font-bold text-white truncate">
              {tenant.businessName || 'Dashboard'}
            </h1>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
            className="p-2 rounded-md hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-white touch-manipulation"
          >
            {isSidebarOpen ? (
              <XMarkIcon className="h-6 w-6 text-gray-300" />
            ) : (
              <Bars3Icon className="h-6 w-6 text-gray-300" />
            )}
          </button>
        </div>
      </div>

      <aside 
        id="mobile-sidebar"
        className={`print:hidden flex-shrink-0 flex flex-col transition-all duration-300 bg-gray-800 text-white z-50
          ${isMobile 
            ? `fixed top-0 left-0 h-full ${isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'}` 
            : `sticky top-0 h-screen ${isSidebarOpen ? 'w-64' : 'w-20'}`
          }`}
      >
        {/* Desktop header */}
        <div className={`hidden lg:flex items-center p-4 border-b border-gray-700 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            {isSidebarOpen && (
                <div className="flex items-center gap-3">
                    {tenant.logoUrl && (
                        <Image 
                          src={tenant.logoUrl} 
                          alt="Logo" 
                          width={32} 
                          height={32} 
                          className="rounded-md object-contain w-8 h-8 lg:w-10 lg:h-10" 
                          priority
                          sizes="(max-width: 1024px) 32px, 40px"
                        />
                    )}
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white truncate leading-tight">
                        {tenant.businessName || 'Dashboard'}
                    </h1>
                </div>
            )}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="p-2 rounded-md hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-white touch-manipulation"
            >
                <Bars3Icon className="h-6 w-6 text-gray-300" />
            </button>
        </div>
        
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
                {tenant.logoUrl && (
                    <Image 
                      src={tenant.logoUrl} 
                      alt="Logo" 
                      width={28} 
                      height={28} 
                      className="rounded-md object-contain w-7 h-7" 
                      priority
                      sizes="28px"
                    />
                )}
                <h1 className="text-base sm:text-lg font-bold text-white truncate leading-tight">
                    {tenant.businessName || 'Dashboard'}
                </h1>
            </div>
            <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="p-2 rounded-md hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-white touch-manipulation"
            >
                <XMarkIcon className="h-6 w-6 text-gray-300" />
            </button>
        </div>
        <nav className="flex-grow space-y-1 px-4 mt-4 overflow-y-auto">
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
                <div className="pt-4 pb-2 px-4 text-xs font-semibold text-gray-500 uppercase">
                  {(isSidebarOpen || isMobile) && 'Admin'}
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
        <div className="p-4 mt-auto border-t border-gray-700">
            <button 
              onClick={() => signOut({ callbackUrl: '/auth/signin' })} 
              className={`flex w-full items-center space-x-4 rounded-lg px-4 py-3 text-gray-400 transition-colors hover:bg-gray-700/50 hover:text-white active:bg-gray-600/50 touch-manipulation ${
                !isSidebarOpen && !isMobile && 'justify-center'
              }`}
            >
              <ArrowRightOnRectangleIcon className="h-6 w-6" />
              {(isSidebarOpen || isMobile) && <span className="font-medium">Logout</span>}
            </button>
        </div>
      </aside>

      <main className={`flex-1 overflow-x-hidden ${isMobile ? 'pt-16' : ''}`}>
        <div className="p-4 sm:p-6 lg:p-8 xl:p-10">
            {children}
        </div>
      </main>
    </div>
  );
}
