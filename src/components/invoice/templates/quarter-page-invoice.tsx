'use client';

import React from 'react';
import Barcode from 'react-barcode';
import { InvoiceData, InvoiceFormatConfig } from '@/types/invoice';

interface QuarterPageInvoiceProps {
  data: InvoiceData;
  config: InvoiceFormatConfig;
  showCutLines?: boolean;
}

/**
 * Quarter-page invoice template component
 * Renders an invoice in minimal layout that fits four invoices per A4 page (2×2 grid)
 * Includes all essential information: barcode, addresses, totals, phone numbers
 */
export function QuarterPageInvoice({ data, config, showCutLines = false }: QuarterPageInvoiceProps) {
  const {
    invoiceNumber,
    businessName,
    businessAddress,
    businessPhone,
    customerName,
    customerAddress,
    customerPhone,
    amount,
    productName,
    quantity,
    discount,
  } = data;

  const { fontSize, barcodeSize, margins } = config;

  // Calculate final amount after discount
  const finalAmount = amount - discount;

  return (
    <div
      className="bg-white text-black print:shadow-none"
      style={{
        width: `${config.dimensions.width}mm`,
        height: `${config.dimensions.height}mm`,
        padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
        fontSize: `${fontSize.normal}pt`,
        position: 'relative',
        border: showCutLines ? '1px dashed #999' : 'none',
      }}
    >
      {/* Header Section - Minimal */}
      <div className="mb-2">
        <div className="flex justify-between items-start mb-1">
          <h1
            className="font-bold"
            style={{ fontSize: `${fontSize.title}pt` }}
          >
            {businessName || 'Your Company'}
          </h1>
          <span
            className="font-bold"
            style={{ fontSize: `${fontSize.normal}pt` }}
          >
            INV
          </span>
        </div>
        <p style={{ fontSize: `${fontSize.small}pt` }}>
          {businessPhone || 'Your Phone'}
        </p>
        <p style={{ fontSize: `${fontSize.small}pt` }}>
          #{invoiceNumber}
        </p>
      </div>

      {/* Customer Information - Minimal */}
      <div className="mb-2 border-t border-gray-300 pt-1">
        <p
          className="font-semibold"
          style={{ fontSize: `${fontSize.small}pt` }}
        >
          {customerName}
        </p>
        <p style={{ fontSize: `${fontSize.small}pt` }}>{customerAddress}</p>
        <p style={{ fontSize: `${fontSize.small}pt` }}>
          {customerPhone}
        </p>
      </div>

      {/* Items - Minimal */}
      <div className="mb-2">
        <div className="flex justify-between border-b border-gray-300 pb-1">
          <span style={{ fontSize: `${fontSize.small}pt` }}>
            {productName}
          </span>
          <span style={{ fontSize: `${fontSize.small}pt` }}>
            x{quantity}
          </span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between pt-1">
            <span style={{ fontSize: `${fontSize.small}pt` }}>
              Discount:
            </span>
            <span style={{ fontSize: `${fontSize.small}pt` }}>
              -LKR {discount.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between pt-1 font-bold">
          <span style={{ fontSize: `${fontSize.normal}pt` }}>
            Total:
          </span>
          <span style={{ fontSize: `${fontSize.normal}pt` }}>
            LKR {finalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Barcode - Minimal */}
      <div className="text-center mt-2">
        <Barcode
          value={invoiceNumber}
          width={barcodeSize.width / 40} // Convert mm to barcode width units
          height={barcodeSize.height}
          fontSize={fontSize.small}
          background="transparent"
        />
      </div>
    </div>
  );
}
