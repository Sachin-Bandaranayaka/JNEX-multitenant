import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { ShipmentPrint } from '@/components/shipping/shipment-print';

export default async function Page({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<{ format?: string }> }) {
  const guard = await requirePermission('VIEW_SHIPPING');
  if (!guard.ok) redirect('/unauthorized');
  const { batchId } = await params;
  const { format } = await searchParams;
  const batch = await prisma.shipmentBatch.findFirst({ where: { id: batchId, tenantId: guard.tenantId }, include: { tenant: { select: { businessName: true, businessAddress: true, businessPhone: true, name: true } }, items: { include: { order: { include: { product: { select: { name: true } } } } }, orderBy: { position: 'asc' } } } });
  if (!batch) notFound();
  return <ShipmentPrint batchId={batch.id} provider={batch.provider} format={format || 'standard'} sender={{ name: batch.tenant.businessName || batch.tenant.name, address: batch.tenant.businessAddress || '', phone: batch.tenant.businessPhone || '' }} orders={batch.items.map(item => ({ id: item.order.id, number: item.order.number, customerName: item.order.customerName, customerPhone: item.order.customerPhone, customerSecondPhone: item.order.customerSecondPhone, customerAddress: item.order.customerAddress, customerCity: item.order.customerCity, productName: item.order.product.name, quantity: item.order.quantity, cod: item.order.codAmount ?? item.order.total, trackingNumber: item.order.trackingNumber || '' }))} />;
}
