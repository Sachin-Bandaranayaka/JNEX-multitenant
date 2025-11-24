'use client';

import { useState } from 'react';
import { Invoice } from './invoice';
import { InvoiceFormat, InvoiceData, BatchInvoiceRequest } from '@/types/invoice';
import { Button } from '@/components/ui/button';
import { Download, Printer, FileText } from 'lucide-react';
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
  const [selectedFormat] = useState<InvoiceFormat>(InvoiceFormat.FULL_PAGE);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);

    try {
      const invoiceData: InvoiceData = {
        invoiceNumber,
        businessName: tenant.businessName,
        businessAddress: tenant.businessAddress,
        businessPhone: tenant.businessPhone,
        customerName: order.customerName,
        customerAddress: order.customerAddress,
        customerPhone: order.customerPhone,
        customerSecondPhone: order.customerSecondPhone,
        amount: order.product.price * order.quantity,
        productName: order.product.name,
        quantity: order.quantity,
        discount: order.discount || 0,
        trackingNumber: order.trackingNumber,
        shippingProvider: order.shippingProvider,
        notes: order.notes,
        createdAt: new Date(order.createdAt),
      };

      const batchRequest: BatchInvoiceRequest = {
        invoices: [invoiceData],
        format: selectedFormat,
      };

      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batchRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}-${selectedFormat.toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

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

          <div className="h-6 w-px bg-border mx-2 hidden sm:block" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF}
            className="h-9"
          >
            <Download className="h-4 w-4 mr-2" />
            {isGeneratingPDF ? 'Generating...' : 'PDF'}
          </Button>

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
