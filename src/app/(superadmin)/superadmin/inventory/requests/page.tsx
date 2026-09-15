import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/superadmin-auth';
import { prisma } from '@/lib/prisma';
import { StockRequestClient } from '@/components/inventory/stock-request-client';
import { StockRequestSetupPending } from '@/components/inventory/stock-request-workspace';
export const dynamic = 'force-dynamic';
export default async function StockRequestReviewPage() {
    try { await requireSuperAdmin(); } catch { redirect('/unauthorized'); }
    try {
        const requests = await prisma.stockChangeRequest.findMany({ include: { tenant: { select: { name: true } }, product: { select: { id: true, name: true, code: true, stock: true } }, requestedBy: { select: { name: true } }, reviewedBy: { select: { name: true } }, stockAdjustment: true }, orderBy: { createdAt: 'desc' }, take: 500 });
        return <StockRequestClient mode="review" initialRequests={requests} />;
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2021') return <StockRequestSetupPending />;
        throw error;
    }
}
