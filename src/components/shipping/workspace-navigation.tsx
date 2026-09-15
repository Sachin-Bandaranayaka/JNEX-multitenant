'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { normalizeShippingFilters, ShippingSection } from '@/lib/shipping-workspace';
export function ShippingWorkspaceNavigation() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const destination = (href: string) => {
        const query = new URLSearchParams(searchParams.toString());
        if (href !== pathname) {
            const section: ShippingSection = href === '/shipping/ship' ? 'ship' : href === '/shipping/summary' ? 'summary' : href === '/shipping/delivery' ? 'delivery' : 'shipped';
            const normalized = normalizeShippingFilters(section, Object.fromEntries(query.entries()));
            for (const key of ['status', 'courier', 'view'] as const) {
                if (!normalized[key]) query.delete(key);
            }
        }
        return query.size ? `${href}?${query.toString()}` : href;
    };
    return <nav aria-label="Shipping sections" className="flex flex-wrap gap-1 border-b border-border pb-3">{[
        ['/shipping/ship', 'Ship'], ['/shipping', 'Shipped List'], ['/shipping/summary', 'Shipped Summary'], ['/shipping/delivery', 'Delivery'],
    ].map(([href, label]) => <Link key={href} href={destination(href)} aria-current={pathname === href ? 'page' : undefined} className={`rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${pathname === href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>{label}</Link>)}</nav>;
}
