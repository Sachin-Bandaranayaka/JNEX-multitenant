'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckIcon, PrinterIcon, TruckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

type Stage = 'ship' | 'print' | 'complete';

export function FulfillmentProgress({ stage, orderId, prerequisites = [], nextLeadId }: { stage: Stage; orderId: string; prerequisites?: { label: string; ready: boolean }[]; nextLeadId?: string }) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const [awaitingPrintConfirmation, setAwaitingPrintConfirmation] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const current = stage === 'ship' ? 1 : stage === 'print' ? 2 : 3;
  const steps = ['Confirmed', 'Ship', 'Print', 'Complete'];
  const blocked = prerequisites.some(item => !item.ready);

  const beginPrint = () => { setPrintError(null); window.print(); setAwaitingPrintConfirmation(true); };
  const markPrinted = async () => {
    setPrinting(true); setPrintError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}/invoice-print`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ printed: true }) });
      if (!response.ok) throw new Error('Could not save print status');
      toast.success('Invoice printed. Fulfillment is complete.');
      router.replace(`/orders/${orderId}?flow=fulfillment&stage=complete${nextLeadId ? `&nextLeadId=${encodeURIComponent(nextLeadId)}` : ''}`);
      router.refresh();
    } catch (error) { const message = error instanceof Error ? error.message : 'Could not save print status. Please retry.'; setPrintError(message); toast.error(message); }
    finally { setPrinting(false); }
  };

  const primary = stage === 'ship'
    ? <button form="guided-shipping-form" type="submit" disabled={blocked} className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"><TruckIcon className="h-4 w-4" />Create shipment</button>
    : stage === 'print'
      ? <button type="button" onClick={beginPrint} disabled={printing} className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"><PrinterIcon className="h-4 w-4" />Print invoice</button>
      : null;

  return <section aria-label="Fulfillment progress" className="border border-amber-200 bg-amber-50/60 shadow-sm">
    <div className="flex flex-col gap-4 px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Fulfillment workflow</p><h2 className="mt-0.5 text-base font-bold text-slate-900">{stage === 'ship' ? 'Order confirmed — arrange shipping now' : stage === 'print' ? 'Shipment created — print the invoice next' : 'Dispatch fulfillment complete'}</h2></div><div className="hidden sm:block">{primary}</div></div>
      <ol className="grid grid-cols-4 gap-1">{steps.map((label, index) => { const done = index < current; const active = index === current; return <li key={label}><div className={`mb-2 h-1 ${done || active ? 'bg-amber-500' : 'bg-slate-200'}`} /><div className={`flex items-center gap-1 text-[11px] font-semibold sm:text-xs ${active ? 'text-amber-800' : done ? 'text-emerald-700' : 'text-slate-500'}`}>{done && <CheckIcon className="h-3.5 w-3.5" />}<span>{label}</span></div></li>; })}</ol>
      {stage === 'ship' && <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-amber-200 pt-3">{prerequisites.map(item => <span key={item.label} className={`inline-flex items-center gap-1 text-xs font-semibold ${item.ready ? 'text-emerald-700' : 'text-red-700'}`}>{item.ready ? <CheckIcon className="h-3.5 w-3.5" /> : <ExclamationTriangleIcon className="h-3.5 w-3.5" />}{item.label}</span>)}</div>}
      {stage === 'complete' && <div className="flex flex-wrap gap-2 border-t border-amber-200 pt-3"><Link href={nextLeadId ? `/leads/${nextLeadId}` : '/leads?status=PENDING'} className="rounded-md bg-amber-500 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600">{nextLeadId ? 'Open next lead' : 'Process next lead'}</Link><Link href="/dashboard" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Go to work queue</Link><Link href={`/orders/${orderId}`} className="px-3 py-2 text-sm font-semibold text-slate-600">Exit guided flow</Link></div>}
    </div>
    {primary && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-200 bg-white/95 p-3 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden pb-[max(.75rem,env(safe-area-inset-bottom))] [&>button]:w-full">{primary}</div>}
    {awaitingPrintConfirmation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="print-result-title"><div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 text-amber-700"><PrinterIcon className="h-5 w-5" /></div><h3 id="print-result-title" className="mt-4 text-lg font-bold text-slate-900">Did the invoice print successfully?</h3><p className="mt-1 text-sm text-slate-600">Only mark it printed after checking the paper. This keeps the fulfillment record accurate.</p>{printError && <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{printError}</div>}<div className="mt-5 grid gap-2 sm:grid-cols-2"><button onClick={markPrinted} disabled={printing} className="rounded-md bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60">{printing ? 'Saving…' : 'Yes, mark printed'}</button><button onClick={beginPrint} disabled={printing} className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Print again</button><button onClick={() => { setAwaitingPrintConfirmation(false); setPrintError(null); }} disabled={printing} className="sm:col-span-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">Not printed — keep it pending</button></div></div></div>}
  </section>;
}
