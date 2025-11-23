'use client';

import React from 'react';
import Barcode from 'react-barcode';
import { InvoiceData, InvoiceFormatConfig } from '@/types/invoice';

interface FullPageInvoiceProps {
  data: InvoiceData;
  config: InvoiceFormatConfig;
  showCutLines?: boolean;
}

/**
 * Full-page invoice template component
 * Renders a single invoice occupying one complete A4 page with generous spacing
 * Includes all essential information: barcode, addresses, totals, phone numbers
 */
export function FullPageInvoice({ data, config, showCutLines = false }: FullPageInvoiceProps) {
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
    notes,
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
      }}
    >
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        {/* Business Information */}
        <div className="w-1/2">
          <h1
            className="font-bold mb-2"
            style={{ fontSize: `${fontSize.title}pt` }}
          >
            {businessName || 'Your Company'}
          </h1>
          <p style={{ fontSize: `${fontSize.normal}pt` }}>
            {businessAddress || 'Your Address'}
          </p>
          <p style={{ fontSize: `${fontSize.normal}pt` }}>
            Tel: {businessPhone || 'Your Phone'}
          </p>
        </div>

        {/* Invoice Number and Date */}
        <div className="w-1/2 text-right">
          <h2
            className="font-bold mb-2"
            style={{ fontSize: `${fontSize.title}pt` }}
          >
            INVOICE
          </h2>
          <p style={{ fontSize: `${fontSize.normal}pt` }}>
            Invoice #: {invoiceNumber}
          </p>
          <p style={{ fontSize: `${fontSize.small}pt` }}>
            Date: {new Date(createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Customer Information */}
      <div className="mb-6 border-t border-b border-gray-300 py-4">
        <h3
          className="font-semibold mb-2"
          style={{ fontSize: `${fontSize.normal}pt` }}
        >
          Bill To:
        </h3>
        <p style={{ fontSize: `${fontSize.normal}pt` }}>{customerName}</p>
        <p style={{ fontSize: `${fontSize.normal}pt` }}>{customerAddress}</p>
        <p style={{ fontSize: `${fontSize.normal}pt` }}>
          Tel: {customerPhone}
        </p>
        {customerSecondPhone && (
          <p style={{ fontSize: `${fontSize.normal}pt` }}>
            Tel 2: {customerSecondPhone}
          </p>
        )}
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th
                className="text-left py-2"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                Item
              </th>
              <th
                className="text-center py-2"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                Qty
              </th>
              <th
                className="text-right py-2"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2" style={{ fontSize: `${fontSize.normal}pt` }}>
                {productName}
              </td>
              <td
                className="text-center py-2"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                {quantity}
              </td>
              <td
                className="text-right py-2"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                LKR {amount.toFixed(2)}
              </td>
            </tr>
            {discount > 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="text-right py-2"
                  style={{ fontSize: `${fontSize.normal}pt` }}
                >
                  Discount:
                </td>
                <td
                  className="text-right py-2"
                  style={{ fontSize: `${fontSize.normal}pt` }}
                >
                  -LKR {discount.toFixed(2)}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-800">
              <td
                colSpan={2}
                className="text-right py-2 font-bold"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                Total:
              </td>
              <td
                className="text-right py-2 font-bold"
                style={{ fontSize: `${fontSize.normal}pt` }}
              >
                LKR {finalAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Shipping Information */}
      {(trackingNumber || shippingProvider) && (
        <div className="mb-4">
          <h3
            className="font-semibold mb-2"
            style={{ fontSize: `${fontSize.normal}pt` }}
          >
            Shipping Information:
          </h3>
          {shippingProvider && (
            <p style={{ fontSize: `${fontSize.small}pt` }}>
              Provider: {shippingProvider}
            </p>
          )}
          {trackingNumber && (
            <p style={{ fontSize: `${fontSize.small}pt` }}>
              Tracking: {trackingNumber}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="mb-4">
          <h3
            className="font-semibold mb-2"
            style={{ fontSize: `${fontSize.normal}pt` }}
          >
            Notes:
          </h3>
          <p style={{ fontSize: `${fontSize.small}pt` }}>{notes}</p>
        </div>
      )}

      {/* Footer Section */}
      <div className="mt-auto flex justify-between items-end">
        <p
          className="italic"
          style={{ fontSize: `${fontSize.normal}pt` }}
        >
          Thank you for your business!
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
