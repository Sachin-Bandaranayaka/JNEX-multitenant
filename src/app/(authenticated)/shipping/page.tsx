import { ShippingWorkspacePage } from '@/components/shipping/workspace-page';
import { ShippingFilters } from '@/lib/shipping-workspace';
import { ShipmentBatchList } from '@/components/shipping/shipment-batch-list';
import { requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
export default async function Page({ searchParams }: { searchParams: Promise<ShippingFilters> }) {
    const guard = await requirePermission('VIEW_SHIPPING');
    if (!guard.ok) redirect('/unauthorized');
    const batches = await prisma.shipmentBatch.findMany({ where: { tenantId: guard.tenantId }, include: { user: { select: { name: true } }, items: { select: { order: { select: { number: true } } } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return <div className="space-y-6"><ShipmentBatchList batches={batches} /><details className="rounded-lg border bg-card p-4"><summary className="cursor-pointer font-semibold">Order-level shipment records and filters</summary><div className="mt-5"><ShippingWorkspacePage section="shipped" searchParams={searchParams} /></div></details></div>;
}
