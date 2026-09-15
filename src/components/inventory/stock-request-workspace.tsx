import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/authz';
import { can } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { StockRequestClient } from './stock-request-client';

export async function StockRequestWorkspace({ mode }: { mode: 'adjustments' | 'summary' | 'waste' }) {
    const guard = await requirePermission('VIEW_PRODUCTS');
    if (!guard.ok) redirect('/unauthorized');
    try {
        const [requests, products] = await Promise.all([
            prisma.stockChangeRequest.findMany({ where: { tenantId: guard.tenantId, ...(mode === 'waste' ? { kind: 'WASTE' } : {}) }, include: { product: { select: { id: true, code: true, name: true, stock: true } }, requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } }, stockAdjustment: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
            prisma.product.findMany({ where: { tenantId: guard.tenantId, isActive: true }, select: { id: true, name: true, code: true, stock: true }, orderBy: { name: 'asc' } }),
        ]);
        return <StockRequestClient mode={mode} initialRequests={requests} products={products} canCreate={can(guard.session.user, 'EDIT_PRODUCTS')} />;
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2021') return <StockRequestSetupPending />;
        throw error;
    }
}
export function StockRequestSetupPending() {
    return <div className="m-6 rounded-xl border border-border bg-card p-6"><h1 className="text-xl font-bold text-foreground">Stock approvals · setup pending</h1><p className="mt-2 text-sm text-muted-foreground">The stock approval database update has not been applied yet. Requests will become available after the platform owner completes setup.</p></div>;
}
