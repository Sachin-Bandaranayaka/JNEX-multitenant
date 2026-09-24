import Link from 'next/link';
import { ShippingProvider } from '@prisma/client';

export const shipmentPrintFormats = [
  ['standard', 'Standard label'], ['dense', 'Dense label'], ['cod-two', 'COD waybill · 2 columns'],
  ['cod-three', 'COD waybill · 3 columns'], ['large', 'Large address label'], ['plain', 'Plain slip'],
] as const;
const courierName = (provider: ShippingProvider) => ({ TRANS_EXPRESS: 'Trans Express', FARDA_EXPRESS: 'Farda Express', SL_POST: 'SL Post', ROYAL_EXPRESS: 'Royal Express' })[provider];
type Batch = { id: string; createdAt: Date; provider: ShippingProvider; user: { name: string | null }; items: { order: { number: number } }[] };

export function ShipmentBatchList({ batches }: { batches: Batch[] }) {
  return <section className="space-y-3"><header><h1 className="text-2xl font-bold">Shipped List</h1><p className="text-sm text-muted-foreground">Shipment batches and their print documents.</p></header>
    <div className="overflow-x-auto rounded-lg border bg-card"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/40"><tr>{['Batch #', 'Shipped items', 'Delivery company', 'Company code', 'Shipped date', 'User', 'Actions'].map(label => <th key={label} className="px-3 py-3 text-left">{label}</th>)}</tr></thead><tbody className="divide-y">{batches.map(batch => <tr key={batch.id}><td className="px-3 py-3 font-semibold">{batch.id.slice(-8).toUpperCase()}</td><td className="px-3 py-3">{batch.items.length}</td><td className="px-3 py-3">{courierName(batch.provider)}</td><td className="px-3 py-3">{batch.provider === 'TRANS_EXPRESS' ? 'TE' : batch.provider === 'FARDA_EXPRESS' ? 'FD' : 'SL'}</td><td className="whitespace-nowrap px-3 py-3">{new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(batch.createdAt)}</td><td className="px-3 py-3">{batch.user.name || '—'}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1"><Link href={`/shipping/batches/${batch.id}`} className="rounded border px-2 py-1 text-primary hover:bg-muted">Details</Link>{shipmentPrintFormats.map(([key, label]) => <Link key={key} href={`/shipping/batches/${batch.id}/print?format=${key}`} title={label} className="rounded border px-2 py-1 text-primary hover:bg-muted">{label}</Link>)}</div></td></tr>)}</tbody></table>{batches.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No shipment batches yet. Ship selected orders to create one.</p>}</div>
  </section>;
}
