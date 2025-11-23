'use client';

import { useState } from 'react';
import { Invoice } from './invoice';
import { FormatSelector } from '@/components/invoice/format-selector';
import { InvoiceFormat, InvoiceData, BatchInvoiceRequest } from '@/types/invoice';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
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
  const [selectedFormat, setSelectedFormat] = useState<InvoiceFormat>(InvoiceFormat.FULL_PAGE);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleGeneratePDF = async () => {
    setIsGeneratingPDF(true);

    try {
      // Convert order to InvoiceData format
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

      // Call the API endpoint to generate PDF
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

      // Download the PDF
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
    <>
      <h2 className="font-semibold text-xl mb-6 text-foreground">Invoice Preview</h2>
      
      {/* Format Selector */}
      <div className="mb-4 bg-card rounded-lg p-4 ring-1 ring-border">
        <FormatSelector 
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
        />
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex gap-2">
        <Button
          onClick={handleGeneratePDF}
          disabled={isGeneratingPDF}
          className="bg-green-600 hover:bg-green-700 flex-1"
        >
          <Download className="h-4 w-4 mr-2" />
          {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
        </Button>
        <Button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 flex-1"
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
      </div>

      {/* Invoice Preview */}
      <div className="bg-white text-black p-4 rounded-md border border-border shadow-sm">
        <Invoice
          businessName={tenant.businessName}
          businessAddress={tenant.businessAddress}
          businessPhone={tenant.businessPhone}
          invoiceNumber={invoiceNumber}
          order={order}
          showPrintControls={false}
        />
      </div>

      {/* Print Status Button */}
      <div className="mt-4">
        <InvoicePrintButton
          orderId={order.id}
          isPrinted={order.invoicePrinted || false}
        />
      </div>
    </>
  );
}
