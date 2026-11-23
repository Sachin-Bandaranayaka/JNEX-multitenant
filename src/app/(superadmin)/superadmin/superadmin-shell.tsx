'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  BuildingOffice2Icon,
  CubeIcon,
  InboxArrowDownIcon,
  BanknotesIcon,
  ShoppingBagIcon,
  ClipboardDocumentCheckIcon,
  ShareIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { LogoutButton } from './logout-button';
import type { PendingCounts } from './attention';

type NavItem = {
  label: string;
  href: string;
  icon: typeof HomeIcon;
  /** Other routes that belong to this item, so it stays highlighted on them. */
  also?: string[];
  badge?: (counts: PendingCounts) => number;
};

const sections: Array<{ title?: string; items: NavItem[] }> = [
  {
    items: [
      { label: 'Home', href: '/superadmin', icon: HomeIcon },
      { label: 'Tenants', href: '/superadmin/users', icon: BuildingOffice2Icon, also: ['/superadmin/tenants', '/superadmin/create'] },
    ],
  },
  {
    title: 'Money',
    items: [
      { label: 'Billing', href: '/superadmin/billing', icon: BanknotesIcon, badge: (c) => c.topUps + c.invoicePayments },
    ],
  },
  {
    title: 'Stock',
    items: [
      { label: 'Stock levels', href: '/superadmin/inventory', icon: CubeIcon },
      { label: 'Stock requests', href: '/superadmin/inventory/requests', icon: InboxArrowDownIcon, badge: (c) => c.stockRequests },
    ],
  },
  {
    title: 'Store',
    items: [
      { label: 'Store products', href: '/superadmin/store', icon: ShoppingBagIcon },
      { label: 'Store orders', href: '/superadmin/store/purchases', icon: ClipboardDocumentCheckIcon, badge: (c) => c.storePurchases },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Referral tree', href: '/superadmin/hierarchy', icon: ShareIcon },
      { label: 'Activity log', href: '/superadmin/audit', icon: ClipboardDocumentListIcon },
      { label: 'Settings', href: '/superadmin/settings', icon: Cog6ToothIcon },
    ],
  },
];

const allItems = sections.flatMap((section) => section.items);

/** The single nav item that best matches the URL — the longest matching prefix wins. */
function activeHref(pathname: string) {
  let best: { href: string; length: number } | null = null;
  for (const item of allItems) {
    for (const prefix of [item.href, ...(item.also ?? [])]) {
      const matches = prefix === '/superadmin' ? pathname === prefix : pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (matches && (!best || prefix.length > best.length)) best = { href: item.href, length: prefix.length };
    }
  }
  return best?.href;
}

export function SuperAdminShell({ children, actorName, counts }: { children: React.ReactNode; actorName: string; counts: PendingCounts }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = activeHref(pathname);

  const sidebar = (
    <aside className="flex h-full w-[248px] flex-col bg-[#1b1d21] text-white">
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <img src="/IMAGES/logo.svg" alt="JNEX" className="h-8 w-8 object-contain" />
        <p className="text-base font-bold">Super Admin</p>
      </div>
      <nav aria-label="Super Admin navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section, index) => (
          <div key={section.title ?? index}>
            {section.title && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{section.title}</p>}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = current === item.href;
                const Icon = item.icon;
                const badge = item.badge?.(counts) ?? 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-[#e10600]' : 'text-slate-400 group-hover:text-white'}`} />
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 && (
                      <span className="min-w-5 rounded-full bg-[#e10600] px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white" aria-label={`${badge} waiting`}>
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="mb-3 truncate px-3 text-sm font-semibold text-white">{actorName}</p>
        <LogoutButton />
      </div>
    </aside>
  );

  return (
    <div className="superadmin-scope min-h-screen bg-[#f5f4f0] text-slate-900">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{sidebar}</div>
      <Dialog open={open} onClose={setOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop transition className="fixed inset-0 bg-slate-950/60 transition-opacity data-[closed]:opacity-0" />
        <div className="fixed inset-0 overflow-hidden">
          <DialogPanel id="superadmin-mobile-menu" transition className="relative h-full w-[248px] shadow-2xl transition-transform duration-200 data-[closed]:-translate-x-full">
            {sidebar}
            <button autoFocus onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-3 rounded-md p-2 text-slate-300 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-red-400"><XMarkIcon className="h-5 w-5" /></button>
          </DialogPanel>
        </div>
      </Dialog>
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-[#f5f4f0]/95 px-4 backdrop-blur sm:px-7 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="superadmin-mobile-menu" className="rounded-md border border-slate-300 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-red-500"><Bars3Icon className="h-5 w-5" /></button>
          <p className="font-bold">Super Admin</p>
        </header>
        <main className="mx-auto max-w-[1480px] p-4 sm:p-7 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
