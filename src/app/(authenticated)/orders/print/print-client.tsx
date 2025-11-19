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
      if (activeTab === 'pending' && selectedOrderIds.length > 0) {
        updatePrintStatus(selectedOrderIds, true);
      }
      setOrdersToPrint([]);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [activeTab, selectedOrderIds]);

  const handlePrint = () => {
    if (selectedOrderIds.length === 0) {
      toast.warning('Please select at least one invoice to print.');
      return;
    }
    setOrdersToPrint(orders.filter(o => selectedOrderIds.includes(o.id)));
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          * {
            -webkit-print-color-adjust: none !important;
            print-color-adjust: none !important;
            color-adjust: none !important;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: #fff !important;
            background: #fff !important;
          }
          html {
            background-color: #fff !important;
            background: #fff !important;
          }
          /* Override any dark backgrounds */
          .bg-gray-900, .bg-gray-800, .bg-gray-700 {
            background-color: #fff !important;
            background: #fff !important;
          }
          /* This container for each page of invoices forces a page break after it */
          .print-page-container {
            page-break-after: always;
            background-color: #fff !important;
            background: #fff !important;
          }
          .print-page-container:last-child {
            page-break-after: auto;
          }
          .invoice-item {
            border: 1px solid #000;
            padding: 0mm;
            box-sizing: border-box;
            overflow: hidden;
            color: #000;
            background-color: #fff !important;
            background: #fff !important;
          }
        }
      `}</style>

      <div className="print:hidden container mx-auto p-4 space-y-4 bg-background text-foreground min-h-screen">
        {/* On-screen UI remains the same */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Print Invoices</h1>
          <div className="flex items-center space-x-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 max-h-[70vh] overflow-y-auto">
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
                  <Invoice order={order} businessName={tenant.businessName} businessAddress={tenant.businessAddress} businessPhone={tenant.businessPhone} invoiceNumber={`${tenant.invoicePrefix || 'INV'}-${order.number}`} isMultiPrint={true} showPrintControls={false} printIndex={index + 1} />
                </div>
              ))}
              {currentList.length === 0 && (<div className="col-span-full p-8 text-center text-muted-foreground">No orders in this tab.</div>)}
            </div>
          </div>
        </Tabs>
      </div>

      {/* --- UPDATED: Print view now uses chunking for pagination --- */}
      <div className="hidden print:block bg-white text-black">
        {chunk(ordersToPrint, 8).map((pageOfOrders, pageIndex) => (
          <div key={pageIndex} className="print-page-container">
            <div className="grid grid-cols-2 grid-rows-4 w-full h-full">
              {pageOfOrders.map((order, index) => (
                <div key={order.id} className="invoice-item">
                  <Invoice
                    order={order}
                    businessName={tenant.businessName}
                    businessAddress={tenant.businessAddress}
                    businessPhone={tenant.businessPhone}
                    invoiceNumber={`${tenant.invoicePrefix || 'INV'}-${order.number}`}
                    isMultiPrint={true}
                    showPrintControls={false}
                    printIndex={(pageIndex * 8) + index + 1}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
