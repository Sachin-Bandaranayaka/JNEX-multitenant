'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useSessionStatus } from '@/hooks/use-session-status';
import { Tenant } from '@prisma/client';
import { Header } from '@/components/dashboard/header';
import { Sidebar } from '@/components/dashboard/sidebar';

export default function AuthenticatedUI({ children, tenant }: { children: React.ReactNode; tenant: Tenant; }) {
  useSessionStatus();
  const { data: session, status } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default closed on mobile
  const [isMobile, setIsMobile] = useState(false);

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
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        isMobile={isMobile}
        tenant={tenant}
        userRole={userRole}
        userPermissions={userPermissions}
      />

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
