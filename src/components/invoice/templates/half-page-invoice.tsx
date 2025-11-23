'use client';

import React from 'react';
import Barcode from 'react-barcode';
import { InvoiceData, InvoiceFormatConfig } from '@/types/invoice';

interface HalfPageInvoiceProps {
  data: InvoiceData;
  config: InvoiceFormatConfig;
  showCutLines?: boolean;
}

/**
 * Half-page invoice template component
 * Renders an invoice in a compact layout that fits two invoices per A4 page
 * Includes all essential information: barcode, addresses, totals, phone numbers
 */
export function HalfPageInvoice({ data, config, showCutLines = false }: HalfPageInvoiceProps) {
  const {
    invoiceNumber,
    businessName,
    businessAddress,
    businessPhone,
    customerName,
    customerAddress,
    customerPhone,
    customerSecondPhone,
    amount,
    productName,
    quantity,
    discount,
    trackingNumber,
    shippingProvider,
    createdAt,
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
        borderBottom: showCutLines ? '1px dashed #999' : 'none',
      }}
    >
      {/* Header Section - Compact */}
      <div className="flex justify-between items-start mb-3">
        {/* Business Information */}
        <div className="w-1/2">
          <h1
            className="font-bold mb-1"
            style={{ fontSize: `${fontSize.title}pt` }}
          >
            {businessName || 'Your Company'}
          </h1>
          <p style={{ fontSize: `${fontSize.small}pt` }}>
            {businessAddress || 'Your Address'}
          </p>
          <p style={{ fontSize: `${fontSize.small}pt` }}>
            Tel: {businessPhone || 'Your Phone'}
          </p>
        </div>

        {/* Invoice Number and Date */}
        <div className="w-1/2 text-right">
          <h2
            className="font-bold mb-1"
            style={{ fontSize: `${fontSize.title}pt` }}
          >
            INVOICE
          </h2>
          <p style={{ fontSize: `${fontSize.small}pt` }}>
            #{invoiceNumber}
          </p>
          <p style={{ fontSize: `${fontSize.small}pt` }}>
            {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Customer Information - Compact */}
      <div className="mb-3 border-t border-gray-300 pt-2">
        <h3
          className="font-semibold mb-1"
          style={{ fontSize: `${fontSize.normal}pt` }}
        >
          Bill To:
        </h3>
        <p style={{ fontSize: `${fontSize.small}pt` }}>{customerName}</p>
        <p style={{ fontSize: `${fontSize.small}pt` }}>{customerAddress}</p>
        <p style={{ fontSize: `${fontSize.small}pt` }}>
          Tel: {customerPhone}
          {customerSecondPhone && ` / ${customerSecondPhone}`}
        </p>
      </div>

      {/* Items Table - Compact */}
      <div className="mb-3">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-600">
              <th
                className="text-left py-1"
                style={{ fontSize: `${fontSize.small}pt` }}
              >
                Item
              </th>
              <th
                className="text-center py-1"
                style={{ fontSize: `${fontSize.small}pt` }}
              >
                Qty
              </th>
              <th
                className="text-right py-1"
                style={{ fontSize: `${fontSize.small}pt` }}
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-1" style={{ fontSize: `${fontSize.small}pt` }}>
                {productName}
              </td>
              <td
                className="text-center py-1"
                style={{ fontSize: `${fontSize.small}pt` }}
              >
                {quantity}
              </td>
              <td
                className="text-right py-1"
                style={{ fontSize: `${fontSize.small}pt` }}
              >
                LKR {amount.toFixed(2)}
              </td>
            </tr>
            {discount > 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="text-right py-1"
                  style={{ fontSize: `${fontSize.small}pt` }}
                >
                  Discount:
                </td>
                <td
                  className="text-right py-1"
                  style={{ fontSize: `${fontSize.small}pt` }}
                >
                  -LKR {discount.toFixed(2)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-600">
              <td
                colSpan={2}
                className="text-right py-1 font-bold"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                Total:
              </td>
              <td
                className="text-right py-1 font-bold"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                LKR {finalAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Shipping Information - Compact */}
      {(trackingNumber || shippingProvider) && (
        <div className="mb-2">
          <p style={{ fontSize: `${fontSize.small}pt` }}>
            {shippingProvider && `${shippingProvider}`}
            {trackingNumber && ` - ${trackingNumber}`}
          </p>
        </div>
      )}

      {/* Footer Section - Compact */}
      <div className="flex justify-between items-end mt-2">
        <p
          className="italic"
          style={{ fontSize: `${fontSize.small}pt` }}
        >
          Thank you!
        </p>

        {/* Barcode */}
        <div className="text-center">
          <Barcode
            value={invoiceNumber}
            width={barcodeSize.width / 40} // Convert mm to barcode width units
            height={barcodeSize.height}
            fontSize={fontSize.small}
            background="transparent"
          />
        </div>
      </div>
    </div>
  );
}
