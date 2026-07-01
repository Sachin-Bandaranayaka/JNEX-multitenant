'use client';

import { Invoice } from './invoice';
import { Button } from '@/components/ui/button';
import { Printer, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { InvoicePrintButton } from './invoice-print-button';

interface Product {
  name: string;
  price: number;
}

interface Order {
  id: string;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  customerSecondPhone?: string | null;
  customerAddress: string;
  product: Product;
  quantity: number;
  discount: number;
  notes?: string | null;
  shippingProvider?: string | null;
  trackingNumber?: string | null;
  invoicePrinted?: boolean;
}

interface Tenant {
  businessName: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  invoicePrefix: string | null;
}

interface OrderDetailInvoiceSectionProps {
  order: Order;
  tenant: Tenant;
  invoiceNumber: string;
}

export function OrderDetailInvoiceSection({
  order,
  tenant,
  invoiceNumber,
}: OrderDetailInvoiceSectionProps) {


  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with Title and Actions */}
      <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Invoice Preview
        </h2>

        <div className="flex items-center gap-2">
          <InvoicePrintButton
            orderId={order.id}
            isPrinted={order.invoicePrinted || false}
          />



          <Button
            size="sm"
            onClick={handlePrint}
            className="h-9 bg-primary hover:bg-primary/90"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="p-6 sm:p-8 bg-muted/10 flex-1 flex justify-center items-start min-h-[500px]">
        <div className="relative group">
          {/* Paper Shadow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-b from-black/5 to-black/10 rounded-lg blur opacity-50 transition duration-500 group-hover:opacity-75" />

          {/* The Invoice Paper */}
          <div className="relative bg-white text-black rounded-sm shadow-xl ring-1 ring-black/5 max-w-[210mm] w-full mx-auto transition-transform duration-500 ease-out group-hover:scale-[1.005]">
            <div className="p-1">
              <Invoice
                businessName={tenant.businessName}
                businessAddress={tenant.businessAddress}
                businessPhone={tenant.businessPhone}
                invoiceNumber={invoiceNumber}
                order={order}
                showPrintControls={false}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
