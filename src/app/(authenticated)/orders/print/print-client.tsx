// src/app/(authenticated)/orders/print/print-client.tsx

'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Invoice } from '@/components/orders/invoice';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tenant, Order, Product, OrderStatus } from '@prisma/client';
import { toast } from 'sonner';
import { format } from 'date-fns';


type OrderWithProduct = Order & { product: Product };

interface PrintClientProps {
  initialOrders: OrderWithProduct[];
  tenant: Tenant;
}

// --- NEW: Helper function to split the orders into pages for printing ---
function chunk<T>(array: T[], size: number): T[][] {
  if (!array) return [];
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}


export function PrintClient({ initialOrders, tenant }: PrintClientProps) {
  const [layoutSize, setLayoutSize] = useState(8);
  const [startingPrint, setStartingPrint] = useState(false);
  const [fitCheckOrders, setFitCheckOrders] = useState<OrderWithProduct[]>([]);
  const fitCheckRef = useRef<HTMLDivElement>(null);
  const [fitError, setFitError] = useState<string | null>(null);
  const columns = layoutSize <= 2 ? 1 : 2;
  const rowsPerPage = layoutSize / columns;
  const [orders, setOrders] = useState(initialOrders);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'printed'>('pending');
  const [ordersToPrint, setOrdersToPrint] = useState<OrderWithProduct[]>([]);
  const [printBatchId, setPrintBatchId] = useState<string | null>(null);
  const [awaitingPrintConfirmation, setAwaitingPrintConfirmation] = useState(false);

  const { pendingOrders, printedOrders } = useMemo(() => {
    const sorted = [...orders].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    return {
      pendingOrders: sorted.filter(o => !o.invoicePrinted),
      printedOrders: sorted.filter(o => o.invoicePrinted),
    };
  }, [orders, sortOrder]);

  const currentList = activeTab === 'pending' ? pendingOrders : printedOrders;

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab]);

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderIds(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    const allIdsOnPage = currentList.map(o => o.id);
    if (selectedOrderIds.length === allIdsOnPage.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(allIdsOnPage);
    }
  };

  const updatePrintStatus = async (idsToUpdate: string[], printed: boolean) => {
    const endpoint = printed ? '/api/orders/bulk/mark-printed' : '/api/orders/bulk/mark-pending';
    const successMessage = `${idsToUpdate.length} invoice(s) successfully marked as ${printed ? 'printed' : 'pending'}.`;
    const errorMessage = `Failed to mark as ${printed ? 'printed' : 'pending'}.`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: idsToUpdate }),
      });
      if (!response.ok) throw new Error(errorMessage);

      toast.success(successMessage);
      setOrders(prev =>
        prev.map(order =>
          idsToUpdate.includes(order.id) ? { ...order, invoicePrinted: printed } : order
        )
      );
      setSelectedOrderIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errorMessage);
    }
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      if (printBatchId) setAwaitingPrintConfirmation(true);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [printBatchId]);

  useEffect(() => {
    if (!ordersToPrint.length) return;
    const timer = setTimeout(() => window.print(), 1000);
    return () => clearTimeout(timer);
  }, [ordersToPrint]);

  // Measure the same invoice component at the selected paper-cell dimensions
  // before any print batch is created. Long content must never be silently cut.
  const checkPrintFit = async (candidates: OrderWithProduct[]) => {
    setFitError(null);
    setFitCheckOrders(candidates);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await document.fonts.ready;
    const cells = Array.from(fitCheckRef.current?.querySelectorAll<HTMLElement>('[data-fit-order]') ?? []);
    if (cells.length !== candidates.length) throw new Error('Could not check invoice sizes. Please try again.');
    const overflowing = cells.filter(cell => cell.scrollHeight > cell.clientHeight + 1 || cell.scrollWidth > cell.clientWidth + 1);
    if (overflowing.length) {
      const numbers = overflowing.slice(0, 5).map(cell => `#${cell.dataset.fitOrder}`).join(', ');
      const message = `Invoice ${numbers}${overflowing.length > 5 ? ' and more' : ''} does not fit this layout. Choose fewer invoices per page${layoutSize === 1 ? ' or shorten the order notes/address before printing' : ''}.`;
      setFitError(message);
      throw new Error(message);
    }
  };

  const startPrintBatch = async (orderedIds: string[]) => {
    const candidates = orderedIds.map(id => orders.find(order => order.id === id)).filter(Boolean) as OrderWithProduct[];
    await checkPrintFit(candidates);
    const response = await fetch('/api/orders/print-batches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: orderedIds }),
    });
    if (!response.ok) throw new Error('Could not create print batch');
    const batch = await response.json();
    setPrintBatchId(batch.id);
    setOrdersToPrint(candidates);
  };

  const handlePrint = async () => {
    if (startingPrint || printBatchId) return;
    if (selectedOrderIds.length === 0) {
      toast.warning('Please select at least one invoice to print.');
      return;
    }
    setStartingPrint(true);
    try {
      // Preserve exactly the order currently visible to the operator.
      await startPrintBatch(currentList.filter(o => selectedOrderIds.includes(o.id)).map(o => o.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start printing');
    } finally { setStartingPrint(false); }
  };

  const confirmPrinted = async () => {
    if (!printBatchId) return;
    const response = await fetch(`/api/orders/print-batches/${printBatchId}/confirm`, { method: 'POST' });
    if (!response.ok) return toast.error('Could not confirm the print batch');
    const ids = ordersToPrint.map(o => o.id);
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, invoicePrinted: true } : o));
    setSelectedOrderIds([]);
    setOrdersToPrint([]);
    setPrintBatchId(null);
    setAwaitingPrintConfirmation(false);
    toast.success(`${ids.length} invoice(s) marked as printed.`);
  };

  const reprintLastBatch = async () => {
    if (startingPrint || printBatchId) return;
    setStartingPrint(true);
    try {
      const response = await fetch('/api/orders/print-batches');
      const batch = response.ok ? await response.json() : null;
      if (!batch?.orderIds?.length) return toast.info('No previous print batch found.');
      const candidates = batch.orderIds.map((id: string) => orders.find(order => order.id === id)).filter(Boolean) as OrderWithProduct[];
      if (candidates.length !== batch.orderIds.length) throw new Error('Some invoices from the last batch are no longer available. Select the invoices to print again.');
      await checkPrintFit(candidates);
      setPrintBatchId(batch.id);
      setOrdersToPrint(candidates);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reprint the last batch');
    } finally { setStartingPrint(false); }
  };


  return (
    <>
      <style jsx global>{`
        /* Keep sender identity readable even when recipient addresses are long. */
        .jnex-print-surface > .flex.justify-between:first-child {
          display: grid;
          grid-template-columns: minmax(0, 35fr) minmax(0, 65fr);
          gap: 2mm;
        }
        .jnex-print-surface > .flex.justify-between:first-child > div {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .jnex-print-surface > .flex.justify-between:first-child > .text-right > div {
          font-size: var(--invoice-recipient-size);
        }
        /* Dashboard table spacing must not override physical invoice sizing. */
        .jnex-print-surface table:not(.no-genzo-override) thead th,
        .jnex-print-surface table:not(.no-genzo-override) tbody td {
          padding: 0.5mm 0 !important;
          font-size: inherit !important;
          color: #000 !important;
          white-space: normal !important;
        }
        .jnex-print-surface table:not(.no-genzo-override) .text-right {
          text-align: right !important;
        }
        .jnex-print-surface table:not(.no-genzo-override) th:not(:first-child),
        .jnex-print-surface table:not(.no-genzo-override) td:last-child,
        .jnex-print-surface table:not(.no-genzo-override) tbody td:nth-child(2) {
          white-space: nowrap !important;
          padding-left: 1mm !important;
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
        @media print {
          .print-only {
            display: block !important;
          }
          /* Must match the @page rule in globals.css — the sheet below is sized
             to the resulting 200mm x 287mm printable area */
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            forced-color-adjust: none !important;
          }
          /* Force light mode CSS variables for print */
          :root, html, body, .dark {
            --background: 0 0% 100% !important;
            --foreground: 222.2 84% 4.9% !important;
            --card: 0 0% 100% !important;
            --card-foreground: 222.2 84% 4.9% !important;
            background-color: #fff !important;
            background: #fff !important;
            color: #000 !important;
          }
          html {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #fff !important;
            background: #fff !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #fff !important;
            background: #fff !important;
          }
          /* Override dark mode class backgrounds */
          .dark,
          .dark body,
          .bg-background,
          .bg-gray-900, 
          .bg-gray-800, 
          .bg-gray-700,
          [class*="bg-"] {
            background-color: #fff !important;
            background: #fff !important;
          }
          /* Override all dark backgrounds using attribute selector */
          [data-theme="dark"],
          [class*="dark:"] {
            background-color: #fff !important;
            background: #fff !important;
            color: #000 !important;
          }
          /* Two-column grid with up to 4 content-sized rows — exactly 8
             invoices per A4 sheet. The page remains 1mm under the printable
             area so sub-pixel rounding can never spill onto an extra page. */
          .a4-page {
            width: 200mm;
            height: 286mm;
            page-break-after: always;
            break-after: page;
            overflow: visible;
            position: relative;
          }
          .a4-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .invoice-grid {
            display: grid;
            grid-template-columns: repeat(var(--invoice-columns, 2), minmax(0, 1fr));
            grid-template-rows: repeat(var(--invoice-rows, 4), minmax(0, 1fr));
            height: 100%;
            width: 100%;
            /* Use a physical stroke instead of a CSS-pixel hairline. Some
               Windows/Linux print pipelines round 1px borders away while
               scaling the page to printer DPI. */
            border: 0.25mm solid #000 !important;
            box-sizing: border-box;
          }
          .invoice-cell {
            box-sizing: border-box;
            overflow: visible;
            color: #000 !important;
            background-color: #fff !important;
            background: #fff !important;
            border-color: #000 !important;
            border-style: solid !important;
          }
          /* Ensure text is visible */
          p, h1, h2, h3, span, div, td, th, tr, table {
            color: #000 !important;
          }
          /* Force the print-only container to be white */
          .print-only {
            background-color: #fff !important;
            background: #fff !important;
          }
          /* Override any element that might have dark background */
          #__next,
          main,
          [role="main"] {
            background-color: #fff !important;
            background: #fff !important;
          }
          /* Hide the app layout chrome (sidebar, header) during print */
          header,
          nav,
          aside {
            display: none !important;
          }
          /* Remove layout flex so content fills the full page width */
          body > div,
          #__next > div,
          .flex.min-h-screen {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Explicitly hide preview controls even when they are direct body children. */
          [class~="print:hidden"] {
            display: none !important;
          }
          /* Remove main padding so invoices use full page area */
          main {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
        }
      `}</style>

      <div className="print:hidden container mx-auto p-4 space-y-4 bg-background text-foreground min-h-screen">
        {/* On-screen UI with format selector */}
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h1 className="text-2xl font-bold">Print Invoices</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={reprintLastBatch} disabled={startingPrint || Boolean(printBatchId)} variant="outline">Reprint Last Batch</Button>
            <label className="text-xs text-muted-foreground">A4 invoice layout<select aria-label="A4 invoice layout" value={layoutSize} disabled={startingPrint || Boolean(printBatchId) || awaitingPrintConfirmation} onChange={event=>{ setLayoutSize(Number(event.target.value)); setFitError(null); }} className="ml-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"><option value={1}>Full page · 1 invoice</option><option value={2}>Half page · 2 invoices</option><option value={4}>Quarter page · 4 invoices</option><option value={8}>Compact · 8 invoices</option></select></label>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
              <SelectTrigger aria-label="Invoice sort order" className="w-[180px] bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="newest">Newest First</SelectItem><SelectItem value="oldest">Oldest First</SelectItem></SelectContent>
            </Select>

            <Button onClick={handlePrint} disabled={selectedOrderIds.length === 0 || startingPrint || Boolean(printBatchId)} className="bg-blue-600 hover:bg-blue-700">
              Print Selected ({selectedOrderIds.length})
            </Button>
          </div>
        </div>


        <p className="text-xs text-muted-foreground">Preview width matches the selected paper layout. Scroll horizontally on smaller screens. Invoice fit is checked before printing; choose fewer invoices per sheet if content is too long.</p>
        {fitError && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{fitError}</p>}
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
            <TabsTrigger value="pending" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Pending ({pendingOrders.length})</TabsTrigger>
            <TabsTrigger value="printed" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Printed ({printedOrders.length})</TabsTrigger>
          </TabsList>
          <div className="mt-4 rounded-lg bg-card ring-1 ring-border">
            <div className="flex justify-between items-center gap-4 px-4 py-3 border-b border-border">
              <div className="flex items-center gap-4">
                <input id="select-all-invoices" type="checkbox" className="h-4 w-4 rounded bg-input border-border text-indigo-600 focus:ring-indigo-500" onChange={handleSelectAll} checked={currentList.length > 0 && selectedOrderIds.length === currentList.length} />
                <label htmlFor="select-all-invoices" className="text-sm font-medium">Select All</label>
              </div>
              {activeTab === 'printed' && (
                <Button onClick={() => updatePrintStatus(selectedOrderIds, false)} disabled={selectedOrderIds.length === 0} variant="outline" size="sm">
                  Move to Pending ({selectedOrderIds.length})
                </Button>
              )}
            </div>
            {/* Preview uses the selected layout width and scrolls on narrow screens. */}
            <div className="grid grid-cols-1 gap-4 p-4 max-h-[70vh] overflow-auto">
              {currentList.map((order, index) => (
                <div key={order.id} style={{ minWidth: `${200 / columns + 4}mm` }} className={`rounded-lg bg-card p-1 shadow-md relative cursor-pointer transition-all ${selectedOrderIds.includes(order.id) ? 'ring-2 ring-indigo-500' : 'ring-1 ring-border'}`} onClick={() => handleSelectOrder(order.id)}>
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                    <input type="checkbox" aria-label={`Select invoice for order #${order.number}`} className="h-5 w-5 rounded bg-input border-border text-indigo-600 focus:ring-indigo-500" checked={selectedOrderIds.includes(order.id)} onClick={event => event.stopPropagation()} onChange={() => handleSelectOrder(order.id)} />
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex justify-between items-start mb-1 pl-20 text-foreground">
                    <h3 className="text-xs font-bold">Order #{order.number}</h3>
                    <div className="text-right">
                      <p className="text-xs">{format(new Date(order.createdAt), 'dd/MM/yyyy')}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${order.status === OrderStatus.SHIPPED ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' : 'bg-muted text-muted-foreground'}`}>{order.status}</span>
                    </div>
                  </div>
                  {/* Content height remains visible; fit is checked before printing. */}
                  <div className="jnex-print-surface mx-auto bg-white outline-dashed outline-1 outline-gray-300" style={{ width: `${199.5 / columns - 0.25}mm`, overflowWrap: 'anywhere', '--invoice-recipient-size': layoutSize === 4 ? '10pt' : layoutSize === 8 ? '9pt' : '13pt' } as React.CSSProperties}>
                    <Invoice order={order} businessName={tenant.businessName} businessAddress={tenant.businessAddress} businessPhone={tenant.businessPhone} invoiceNumber={`${tenant.invoicePrefix || 'INV'}-${order.number}`} isMultiPrint={layoutSize === 8} fullPage={layoutSize !== 8} showPrintControls={false} printIndex={index + 1} />
                  </div>
                </div>
              ))}
              {currentList.length === 0 && (<div className="col-span-full p-8 text-center text-muted-foreground">No orders in this tab.</div>)}
            </div>
          </div>
        </Tabs>
      </div>

      {awaitingPrintConfirmation && (
        <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold">Did the invoices print successfully?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Only confirm after checking the printer. Cancelling keeps these invoices pending.</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setAwaitingPrintConfirmation(false); setOrdersToPrint([]); setPrintBatchId(null); }}>No, keep pending</Button>
              <Button onClick={confirmPrinted}>Yes, mark printed</Button>
            </div>
          </div>
        </div>
      )}

      <div ref={fitCheckRef} aria-hidden="true" className="jnex-print-surface print:hidden" style={{ position: 'fixed', left: '-100000px', top: 0, visibility: 'hidden', pointerEvents: 'none', width: '200mm' }}>
        {fitCheckOrders.map(order => <div key={order.id} data-fit-order={order.number} style={{ width: `${199.5 / columns - 0.25}mm`, height: `${285.5 / rowsPerPage - 0.25}mm`, overflowWrap: 'anywhere', '--invoice-recipient-size': layoutSize === 4 ? '10pt' : layoutSize === 8 ? '9pt' : '13pt' } as React.CSSProperties}>
          <Invoice order={order} businessName={tenant.businessName} businessAddress={tenant.businessAddress} businessPhone={tenant.businessPhone} invoiceNumber={`${tenant.invoicePrefix || 'INV'}-${order.number}`} isMultiPrint={layoutSize === 8} fullPage={layoutSize !== 8} showPrintControls={false} printIndex={1} />
        </div>)}
      </div>

      {/* Selected A4 layout; content is measured before creating a print batch. */}
      <div className="jnex-print-surface print-only bg-white text-black">
        {chunk(ordersToPrint, layoutSize).map((pageOrders, pageIndex) => {
          const totalRows = rowsPerPage;
          return (
            <div key={pageIndex} className="a4-page">
              <div className="invoice-grid" style={{ '--invoice-columns': columns, '--invoice-rows': rowsPerPage, '--invoice-recipient-size': layoutSize === 4 ? '10pt' : layoutSize === 8 ? '9pt' : '13pt' } as React.CSSProperties}>
                {pageOrders.map((order, idx) => {
                  const col = idx % columns;
                  const row = Math.floor(idx / columns);
                  // A physical-width stroke survives browser/OS/printer DPI
                  // conversion more reliably than a 1px CSS hairline.
                  const borderRight = col < columns - 1 ? '0.25mm solid #000' : 'none';
                  const borderBottom = row === totalRows - 1 ? 'none' : '0.25mm solid #000';
                  return (
                    <div
                      key={order.id}
                      className="invoice-cell"
                      style={{ borderRight, borderBottom, overflowWrap: 'anywhere' }}
                    >
                      <Invoice
                        order={order}
                        businessName={tenant.businessName}
                        businessAddress={tenant.businessAddress}
                        businessPhone={tenant.businessPhone}
                        invoiceNumber={`${tenant.invoicePrefix || 'INV'}-${order.number}`}
                        isMultiPrint={layoutSize === 8} fullPage={layoutSize !== 8}
                        showPrintControls={false}
                        printIndex={pageIndex * layoutSize + idx + 1}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
