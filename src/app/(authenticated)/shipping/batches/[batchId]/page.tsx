import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { shipmentPrintFormats } from '@/components/shipping/shipment-batch-list';

export default async function Page({ params }: { params: Promise<{ batchId: string }> }) {
  const guard = await requirePermission('VIEW_SHIPPING');
  if (!guard.ok) redirect('/unauthorized');
  const { batchId } = await params;
  const batch = await prisma.shipmentBatch.findFirst({ where: { id: batchId, tenantId: guard.tenantId }, include: { user: { select: { name: true } }, items: { include: { order: { select: { id: true, number: true, customerName: true, customerCity: true, status: true, trackingNumber: true, codAmount: true, total: true } } }, orderBy: { position: 'asc' } } } });
  if (!batch) notFound();
  return <div className="space-y-5"><Link href="/shipping" className="text-sm text-primary hover:underline">← Shipped List</Link><header><h1 className="text-2xl font-bold">Batch {batch.id.slice(-8).toUpperCase()}</h1><p className="text-sm text-muted-foreground">{batch.items.length} orders · {batch.provider.replaceAll('_', ' ')} · {batch.user.name || 'Staff'} · {new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(batch.createdAt)}</p></header><div className="flex flex-wrap gap-2">{shipmentPrintFormats.map(([key, label]) => <Link key={key} href={`/shipping/batches/${batch.id}/print?format=${key}`} className="rounded border bg-card px-3 py-2 text-sm text-primary hover:bg-muted">Print {label}</Link>)}</div><div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[650px] text-sm"><thead className="bg-muted/40"><tr>{['Order', 'Customer', 'City', 'Tracking number', 'COD', 'Status'].map(label => <th key={label} className="px-4 py-3 text-left">{label}</th>)}</tr></thead><tbody className="divide-y">{batch.items.map(item => <tr key={item.order.id}><td className="px-4 py-3"><Link href={`/orders/${item.order.id}`} className="font-semibold text-primary hover:underline">#{item.order.number}</Link></td><td className="px-4 py-3">{item.order.customerName}</td><td className="px-4 py-3">{item.order.customerCity}</td><td className="px-4 py-3">{item.order.trackingNumber}</td><td className="px-4 py-3">Rs. {(item.order.codAmount ?? item.order.total).toLocaleString('en-LK')}</td><td className="px-4 py-3">{item.order.status}</td></tr>)}</tbody></table></div></div>;
}
