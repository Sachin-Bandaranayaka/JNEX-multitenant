// src/app/(superadmin)/layout.tsx

import Link from 'next/link';
// import { HomeIcon, UsersIcon, CogIcon } from '@heroicons/react/24/outline';
import { LogoutButton } from './superadmin/logout-button'; // <-- Import the new component
import { HomeIcon, UsersIcon, CogIcon, ShareIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';

function NavLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode; }) {
    return (
        <Link href={href}>
            <div className="flex items-center space-x-3 rounded-lg px-3 py-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white">
                {icon}
                <span className="font-medium">{children}</span>
            </div>
        </Link>
    );
}

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-gray-900 text-white">
            {/* Sidebar */}
            <aside className="sticky top-0 h-screen w-64 flex flex-col bg-gray-900/80 backdrop-blur-sm ring-1 ring-white/10">
                <div className="p-6 flex items-center gap-3">
                    <img src="/IMAGES/logo.svg" alt="Logo" className="w-8 h-8 object-contain" />
                    <h1 className="text-2xl font-bold text-indigo-400">Super Admin</h1>
                </div>
                <nav className="flex-1 space-y-2 px-4">
                    <NavLink href="/superadmin" icon={<HomeIcon className="h-6 w-6" />}>
                        Dashboard
                    </NavLink>
                    <NavLink href="/superadmin/users" icon={<UsersIcon className="h-6 w-6" />}>
                        Users
                    </NavLink>
                    <NavLink href="/superadmin/hierarchy" icon={<ShareIcon className="h-6 w-6" />}>
                        Hierarchy
                    </NavLink>
                    <NavLink href="/superadmin/store" icon={<ShoppingBagIcon className="h-6 w-6" />}>
                        Store
                    </NavLink>
                    <NavLink href="/superadmin/settings" icon={<CogIcon className="h-6 w-6" />}>
                        Settings
                    </NavLink>
                </nav>
                {/* Add Logout Button at the bottom */}
                <div className="p-4 mt-auto">
                    <LogoutButton />
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-x-hidden bg-gray-800/30 p-6 sm:p-8 lg:p-10">
                <div className="mx-auto max-w-7xl">
                    {children}
                </div>
            </main>
        </div>
    );
}