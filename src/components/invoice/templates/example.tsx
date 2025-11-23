/**
 * Example usage of invoice template components
 * 
 * This file demonstrates how to use the three invoice template components
 * with sample data and configurations.
 */

'use client';

import React, { useState } from 'react';
import { FullPageInvoice } from './full-page-invoice';
import { HalfPageInvoice } from './half-page-invoice';
import { QuarterPageInvoice } from './quarter-page-invoice';
import { InvoiceFormat, InvoiceData } from '@/types/invoice';
import { INVOICE_FORMAT_CONFIGS } from '@/lib/invoice/format-configs';

// Sample invoice data
const sampleInvoiceData: InvoiceData = {
  invoiceNumber: 'INV-2024-001',
  businessName: 'ACME Corporation',
  businessAddress: '123 Business Street, Colombo 00100, Sri Lanka',
  businessPhone: '+94 11 234 5678',
  customerName: 'John Doe',
  customerAddress: '456 Customer Avenue, Kandy 20000, Sri Lanka',
  customerPhone: '+94 77 123 4567',
  customerSecondPhone: '+94 71 987 6543',
  amount: 15000,
  productName: 'Premium Widget Set',
  quantity: 3,
  discount: 500,
  trackingNumber: 'TRK-123456789',
  shippingProvider: 'Express Delivery',
  notes: 'Handle with care. Fragile items.',
  createdAt: new Date('2024-01-15'),
};

export function InvoiceTemplateExample() {
  const [selectedFormat, setSelectedFormat] = useState<InvoiceFormat>(InvoiceFormat.FULL_PAGE);
  const [showCutLines, setShowCutLines] = useState(true);

  const renderInvoice = () => {
    const config = INVOICE_FORMAT_CONFIGS[selectedFormat];

    switch (selectedFormat) {
      case InvoiceFormat.FULL_PAGE:
        return (
          <FullPageInvoice
            data={sampleInvoiceData}
            config={config}
            showCutLines={showCutLines}
          />
        );
      case InvoiceFormat.HALF_PAGE:
        return (
          <HalfPageInvoice
            data={sampleInvoiceData}
            config={config}
            showCutLines={showCutLines}
          />
        );
      case InvoiceFormat.QUARTER_PAGE:
        return (
          <QuarterPageInvoice
            data={sampleInvoiceData}
            config={config}
            showCutLines={showCutLines}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Invoice Template Examples</h1>
        
        {/* Format Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Format:</label>
          <div className="flex gap-4">
            <button
              onClick={() => setSelectedFormat(InvoiceFormat.FULL_PAGE)}
              className={`px-4 py-2 rounded ${
                selectedFormat === InvoiceFormat.FULL_PAGE
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200'
              }`}
            >
              Full Page (1 per sheet)
            </button>
            <button
              onClick={() => setSelectedFormat(InvoiceFormat.HALF_PAGE)}
              className={`px-4 py-2 rounded ${
                selectedFormat === InvoiceFormat.HALF_PAGE
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200'
              }`}
            >
              Half Page (2 per sheet)
            </button>
            <button
              onClick={() => setSelectedFormat(InvoiceFormat.QUARTER_PAGE)}
              className={`px-4 py-2 rounded ${
                selectedFormat === InvoiceFormat.QUARTER_PAGE
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200'
              }`}
            >
              Quarter Page (4 per sheet)
            </button>
          </div>
        </div>

        {/* Cut Lines Toggle */}
        <div className="mb-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showCutLines}
              onChange={(e) => setShowCutLines(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Show cut lines</span>
          </label>
        </div>
      </div>

      {/* Invoice Preview */}
      <div className="border border-gray-300 p-4 bg-gray-50">
        <h2 className="text-lg font-semibold mb-4">Preview:</h2>
        <div className="bg-white shadow-lg">
          {renderInvoice()}
        </div>
      </div>

      {/* Format Information */}
      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h3 className="font-semibold mb-2">Current Format Details:</h3>
        <ul className="text-sm space-y-1">
          <li>
            <strong>Dimensions:</strong>{' '}
            {INVOICE_FORMAT_CONFIGS[selectedFormat].dimensions.width}mm ×{' '}
            {INVOICE_FORMAT_CONFIGS[selectedFormat].dimensions.height}mm
          </li>
          <li>
            <strong>Invoices per page:</strong>{' '}
            {INVOICE_FORMAT_CONFIGS[selectedFormat].invoicesPerPage}
          </li>
          <li>
            <strong>Barcode size:</strong>{' '}
            {INVOICE_FORMAT_CONFIGS[selectedFormat].barcodeSize.width}mm ×{' '}
            {INVOICE_FORMAT_CONFIGS[selectedFormat].barcodeSize.height}mm
          </li>
        </ul>
      </div>
    </div>
  );
}
