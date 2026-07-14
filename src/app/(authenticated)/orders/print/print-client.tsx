// src/app/(authenticated)/orders/print/print-client.tsx

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

  // --- FIX: Use useEffect to trigger print when ordersToPrint changes ---
  useEffect(() => {
    if (ordersToPrint.length > 0) {
      // Use requestAnimationFrame to ensure DOM has painted, then delay to be extra sure
      requestAnimationFrame(() => {
        const timer = setTimeout(() => {
          window.print();
        }, 1000); // Increased delay for safety
        return () => clearTimeout(timer);
      });
    }
  }, [ordersToPrint]);

  const startPrintBatch = async (orderedIds: string[]) => {
    const response = await fetch('/api/orders/print-batches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderIds: orderedIds }),
    });
    if (!response.ok) throw new Error('Could not create print batch');
    const batch = await response.json();
    setPrintBatchId(batch.id);
    setOrdersToPrint(orderedIds.map(id => orders.find(o => o.id === id)).filter(Boolean) as OrderWithProduct[]);
  };

  const handlePrint = async () => {
    if (selectedOrderIds.length === 0) {
      toast.warning('Please select at least one invoice to print.');
      return;
    }
    try {
      // Preserve exactly the order currently visible to the operator.
      await startPrintBatch(currentList.filter(o => selectedOrderIds.includes(o.id)).map(o => o.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start printing');
    }
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
    const response = await fetch('/api/orders/print-batches');
    const batch = response.ok ? await response.json() : null;
    if (!batch?.orderIds?.length) return toast.info('No previous print batch found.');
    setPrintBatchId(batch.id);
    setOrdersToPrint(batch.orderIds.map((id: string) => orders.find(o => o.id === id)).filter(Boolean));
  };



  return (
    <>
      <style jsx global>{`
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
            overflow: hidden;
            position: relative;
          }
          .a4-page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .invoice-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-auto-rows: auto;
            width: 100%;
            /* Use a physical stroke instead of a CSS-pixel hairline. Some
               Windows/Linux print pipelines round 1px borders away while
               scaling the page to printer DPI. */
            border: 0.25mm solid #000 !important;
            box-sizing: border-box;
          }
          .invoice-cell {
            box-sizing: border-box;
            overflow: hidden;
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
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Print Invoices</h1>
          <div className="flex items-center space-x-4">
            <Button onClick={reprintLastBatch} variant="outline">Reprint Last Batch</Button>
            <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as any)}>
              <SelectTrigger className="w-[180px] bg-card border-border"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="newest">Newest First</SelectItem><SelectItem value="oldest">Oldest First</SelectItem></SelectContent>
            </Select>

            <Button onClick={handlePrint} disabled={selectedOrderIds.length === 0} className="bg-blue-600 hover:bg-blue-700">
              Print Selected ({selectedOrderIds.length})
            </Button>
          </div>
        </div>


        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
            <TabsTrigger value="pending" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Pending ({pendingOrders.length})</TabsTrigger>
            <TabsTrigger value="printed" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">Printed ({printedOrders.length})</TabsTrigger>
          </TabsList>
          <div className="mt-4 rounded-lg bg-card ring-1 ring-border">
            <div className="flex justify-between items-center gap-4 px-4 py-3 border-b border-border">
              <div className="flex items-center gap-4">
                <input type="checkbox" className="h-4 w-4 rounded bg-input border-border text-indigo-600 focus:ring-indigo-500" onChange={handleSelectAll} checked={currentList.length > 0 && selectedOrderIds.length === currentList.length} />
                <label className="text-sm font-medium">Select All</label>
              </div>
              {activeTab === 'printed' && (
                <Button onClick={() => updatePrintStatus(selectedOrderIds, false)} disabled={selectedOrderIds.length === 0} variant="outline" size="sm">
                  Move to Pending ({selectedOrderIds.length})
                </Button>
              )}
            </div>
            {/* Cards sized to fit the true-size (100mm wide) print preview below */}
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(420px,1fr))] gap-4 p-4 max-h-[70vh] overflow-y-auto">
              {currentList.map((order, index) => (
                <div key={order.id} className={`rounded-lg bg-card p-1 shadow-md relative cursor-pointer transition-all ${selectedOrderIds.includes(order.id) ? 'ring-2 ring-indigo-500' : 'ring-1 ring-border'}`} onClick={() => handleSelectOrder(order.id)}>
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                    <input type="checkbox" className="h-5 w-5 rounded bg-input border-border text-indigo-600 focus:ring-indigo-500 pointer-events-none" checked={selectedOrderIds.includes(order.id)} readOnly />
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="flex justify-between items-start mb-1 pl-20 text-foreground">
                    <h3 className="text-xs font-bold">Order ID: {order.id.substring(0, 8)}...</h3>
                    <div className="text-right">
                      <p className="text-xs">{format(new Date(order.createdAt), 'dd/MM/yyyy')}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${order.status === OrderStatus.SHIPPED ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' : 'bg-muted text-muted-foreground'}`}>{order.status}</span>
                    </div>
                  </div>
                  {/* True-width, content-height preview matching the compact print cell */}
                  <div className="mx-auto w-[100mm] bg-white outline-dashed outline-1 outline-gray-300">
                    <Invoice order={order} businessName={tenant.businessName} businessAddress={tenant.businessAddress} businessPhone={tenant.businessPhone} invoiceNumber={`${tenant.invoicePrefix || 'INV'}-${order.number}`} isMultiPrint={true} showPrintControls={false} printIndex={index + 1} />
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

      {/* --- Fixed 2x4 grid: exactly 8 invoices per A4 sheet --- */}
      <div className="print-only bg-white text-black">
        {chunk(ordersToPrint, 8).map((pageOrders, pageIndex) => {
          const totalRows = Math.ceil(pageOrders.length / 2);
          return (
            <div key={pageIndex} className="a4-page">
              <div className="invoice-grid">
                {pageOrders.map((order, idx) => {
                  const col = idx % 2;
                  const row = Math.floor(idx / 2);
                  // A physical-width stroke survives browser/OS/printer DPI
                  // conversion more reliably than a 1px CSS hairline.
                  const borderRight = col === 0 ? '0.25mm solid #000' : 'none';
                  const borderBottom = row === totalRows - 1 ? 'none' : '0.25mm solid #000';
                  return (
                    <div
                      key={order.id}
                      className="invoice-cell"
                      style={{ borderRight, borderBottom }}
                    >
                      <Invoice
                        order={order}
                        businessName={tenant.businessName}
                        businessAddress={tenant.businessAddress}
                        businessPhone={tenant.businessPhone}
                        invoiceNumber={`${tenant.invoicePrefix || 'INV'}-${order.number}`}
                        isMultiPrint={true}
                        showPrintControls={false}
                        printIndex={pageIndex * 8 + idx + 1}
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
