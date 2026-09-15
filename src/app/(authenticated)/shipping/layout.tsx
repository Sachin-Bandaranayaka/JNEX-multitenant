import { Suspense } from 'react';
import { ShippingWorkspaceNavigation } from '@/components/shipping/workspace-navigation';
export default function ShippingLayout({ children }: { children: React.ReactNode }) {
    return <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8"><Suspense fallback={<p className="text-sm text-muted-foreground">Loading shipping sections…</p>}><ShippingWorkspaceNavigation /></Suspense>{children}</div>;
}
