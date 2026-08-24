'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { Bars3Icon, XMarkIcon, Squares2X2Icon, BuildingOffice2Icon, CubeIcon, BanknotesIcon, ShoppingBagIcon, ShareIcon, ClipboardDocumentListIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { LogoutButton } from './logout-button';

const navigation = [
  { label: 'Overview', href: '/superadmin', icon: Squares2X2Icon, exact: true },
  { label: 'Tenants', href: '/superadmin/users', icon: BuildingOffice2Icon },
  { label: 'Inventory Control', href: '/superadmin/inventory', icon: CubeIcon },
  { label: 'Billing', href: '/superadmin/billing', icon: BanknotesIcon },
  { label: 'Store', href: '/superadmin/store', icon: ShoppingBagIcon },
  { label: 'Hierarchy', href: '/superadmin/hierarchy', icon: ShareIcon },
  { label: 'Audit Log', href: '/superadmin/audit', icon: ClipboardDocumentListIcon },
  { label: 'Settings', href: '/superadmin/settings', icon: Cog6ToothIcon },
];

export function SuperAdminShell({ children, actorName }: { children: React.ReactNode; actorName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebar = (
    <aside className="flex h-full w-[272px] flex-col bg-[#1b1d21] text-white">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <img src="/IMAGES/logo.svg" alt="JNEX" className="h-9 w-9 object-contain" />
        <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">Owner console</p><p className="text-base font-bold">Super Admin</p></div>
      </div>
      <nav aria-label="Super Admin navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {navigation.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}><Icon className={`h-5 w-5 ${active ? 'text-[#e10600]' : 'text-slate-400 group-hover:text-white'}`} />{item.label}</Link>;
        })}
      </nav>
      <div className="border-t border-white/10 p-4"><p className="truncate px-3 text-sm font-semibold text-white">{actorName}</p><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Authenticated owner</p><LogoutButton /></div>
    </aside>
  );
  return (
    <div className="min-h-screen bg-[#f5f4f0] text-slate-900">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
      <Dialog open={open} onClose={setOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-slate-950/60 transition-opacity data-[closed]:opacity-0" />
        <div className="fixed inset-0 overflow-hidden">
          <DialogPanel id="superadmin-mobile-menu" transition className="relative h-full w-[272px] shadow-2xl transition-transform duration-200 data-[closed]:-translate-x-full">
            {sidebar}
            <button autoFocus onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 rounded-md p-2 text-slate-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-red-400"><XMarkIcon className="h-5 w-5" /></button>
          </DialogPanel>
        </div>
      </Dialog>
      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-[#f5f4f0]/95 px-4 backdrop-blur sm:px-7 lg:px-10">
          <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="superadmin-mobile-menu" className="rounded-md border border-slate-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-red-500 lg:hidden"><Bars3Icon className="h-5 w-5" /></button>
          <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 sm:flex"><span className="h-2 w-2 rounded-full bg-emerald-500" />System oversight online</div>
          <div className="ml-auto rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">{actorName}</div>
        </header>
        <main className="mx-auto max-w-[1480px] p-4 sm:p-7 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
