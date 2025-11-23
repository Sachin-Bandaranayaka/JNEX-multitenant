'use client';

import React from 'react';
import { InvoiceFormat, InvoiceData } from '@/types/invoice';
import { INVOICE_FORMAT_CONFIGS } from '@/lib/invoice/format-configs';
import { FullPageInvoice } from './templates/full-page-invoice';
import { HalfPageInvoice } from './templates/half-page-invoice';
import { QuarterPageInvoice } from './templates/quarter-page-invoice';
import { InvoiceErrorBoundary } from './invoice-error-boundary';

interface InvoicePreviewProps {
  format: InvoiceFormat;
  showCutLines?: boolean;
  sampleData?: InvoiceData;
}

/**
 * Sample invoice data for preview purposes
 */
const DEFAULT_SAMPLE_DATA: InvoiceData = {
  invoiceNumber: 'INV-2024-001',
  businessName: 'Sample Business Inc.',
  businessAddress: '123 Business Street, Colombo 00100, Sri Lanka',
  businessPhone: '+94 11 234 5678',
  customerName: 'John Doe',
  customerAddress: '456 Customer Avenue, Kandy 20000, Sri Lanka',
  customerPhone: '+94 77 123 4567',
  customerSecondPhone: '+94 71 987 6543',
  amount: 15000,
  productName: 'Sample Product',
  quantity: 2,
  discount: 500,
  trackingNumber: 'TRK123456789',
  shippingProvider: 'Express Delivery',
  notes: 'Please handle with care',
  createdAt: new Date(),
};

/**
 * InvoicePreview component renders a preview of the selected invoice format
 * Updates automatically when format changes
 * Shows cut lines in preview mode
 * Displays sample data for visualization
 */
export function InvoicePreview({
  format,
  showCutLines = true,
  sampleData = DEFAULT_SAMPLE_DATA,
}: InvoicePreviewProps) {
  // Validate format and provide fallback
  let config;
  try {
    config = INVOICE_FORMAT_CONFIGS[format];
    if (!config) {
      console.error('Invalid format provided:', format);
      config = INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE];
    }
  } catch (error) {
    console.error('Error getting format config:', error);
    config = INVOICE_FORMAT_CONFIGS[InvoiceFormat.FULL_PAGE];
  }

  // Render the appropriate template based on format
  const renderInvoiceTemplate = () => {
    switch (format) {
      case InvoiceFormat.FULL_PAGE:
        return (
          <FullPageInvoice
            data={sampleData}
            config={config}
            showCutLines={showCutLines}
          />
        );
      case InvoiceFormat.HALF_PAGE:
        return (
          <>
            <HalfPageInvoice
              data={sampleData}
              config={config}
              showCutLines={showCutLines}
            />
            {/* Show second invoice for half-page preview */}
            <HalfPageInvoice
              data={{
                ...sampleData,
                invoiceNumber: 'INV-2024-002',
                customerName: 'Jane Smith',
              }}
              config={config}
              showCutLines={showCutLines}
            />
          </>
        );
      case InvoiceFormat.QUARTER_PAGE:
        return (
          <div className="grid grid-cols-2 gap-0">
            {/* Show four invoices for quarter-page preview */}
            <QuarterPageInvoice
              data={sampleData}
              config={config}
              showCutLines={showCutLines}
            />
            <QuarterPageInvoice
              data={{
                ...sampleData,
                invoiceNumber: 'INV-2024-002',
                customerName: 'Jane Smith',
              }}
              config={config}
              showCutLines={showCutLines}
            />
            <QuarterPageInvoice
              data={{
                ...sampleData,
                invoiceNumber: 'INV-2024-003',
                customerName: 'Bob Johnson',
              }}
              config={config}
              showCutLines={showCutLines}
            />
            <QuarterPageInvoice
              data={{
                ...sampleData,
                invoiceNumber: 'INV-2024-004',
                customerName: 'Alice Williams',
              }}
              config={config}
              showCutLines={showCutLines}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <InvoiceErrorBoundary>
      <div className="invoice-preview-container">
        {/* Preview Header */}
        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">
          Preview: {config.format.replace('_', ' ')}
        </h3>
        <p className="text-sm text-gray-400">
          {config.invoicesPerPage} invoice{config.invoicesPerPage > 1 ? 's' : ''} per page
          {' • '}
          {config.dimensions.width}×{config.dimensions.height}mm
        </p>
        {showCutLines && config.invoicesPerPage > 1 && (
          <p className="text-xs text-gray-500 mt-1">
            Dashed lines indicate where to cut
          </p>
        )}
      </div>

      {/* Preview Content - Scaled to fit screen */}
      <div className="preview-content bg-gray-700 p-4 rounded-lg overflow-auto">
        <div
          className="mx-auto shadow-lg"
          style={{
            width: '210mm',
            minHeight: '297mm',
            transform: 'scale(0.5)',
            transformOrigin: 'top center',
            marginBottom: '-148.5mm', // Adjust for scale
          }}
        >
          {renderInvoiceTemplate()}
        </div>
      </div>

        {/* Preview Legend */}
        {showCutLines && config.invoicesPerPage > 1 && (
          <div className="mt-4 p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-8 h-0 border-t border-dashed border-gray-400"></div>
              <span>Cut line</span>
            </div>
          </div>
        )}
      </div>
    </InvoiceErrorBoundary>
  );
}
