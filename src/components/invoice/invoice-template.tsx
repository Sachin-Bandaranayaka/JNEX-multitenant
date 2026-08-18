'use client';

import Barcode from 'react-barcode';

// --- FIX: Update props to accept dynamic tenant information ---
interface InvoiceTemplateProps {
  businessName: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  invoiceNumber: string; // The full invoice number (e.g., "INV-12345")
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  amount: number;
}

export function InvoiceTemplate({
  businessName,
  businessAddress,
  businessPhone,
  invoiceNumber,
  customerName,
  customerAddress,
  customerPhone,
  amount,
}: InvoiceTemplateProps) {

  return (
    <div className="jnex-print-surface w-full max-w-2xl mx-auto p-6 bg-white text-black">
      <div className="flex justify-between items-start">
        {/* Left side - Company Info */}
        <div className="w-1/2">
          {/* --- FIX: Display dynamic business info --- */}
          <h2 className="font-bold text-xl">{businessName || 'Your Company'}</h2>
          <p className="text-xs">{businessAddress || 'Your Address'}</p>
          <p className="text-xs">Tel: {businessPhone || 'Your Phone'}</p>
          <p className="text-xs mt-2">Invoice #: {invoiceNumber}</p>
        </div>

        {/* Right side - Customer Info */}
        <div className="w-1/2 text-right">
          <h3 className="font-semibold">To: {customerName}</h3>
          <p className="text-xs">{customerAddress}</p>
          <p className="text-xs">Tel: {customerPhone}</p>
        </div>
      </div>
      
      <div className="mt-8">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-2 border-b-2 border-gray-800">Item</th>
              <th className="py-2 border-b-2 border-gray-800 text-center">Qty</th>
              <th className="py-2 border-b-2 border-gray-800 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2">Item from Order</td>
              <td className="py-2 text-center">1</td>
              <td className="py-2 text-right">LKR {amount.toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="py-2 border-t-2 border-gray-800 text-right font-bold">Total:</td>
              <td className="py-2 border-t-2 border-gray-800 text-right font-bold">LKR {amount.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-8 flex justify-between items-end">
          <p className="text-xs">Thank you!</p>
          <div className="text-center">
              {/* --- FIX: Use the full invoice number for the barcode --- */}
              <Barcode
                  value={invoiceNumber}
                  width={1.5}
                  height={50}
                  fontSize={12}
                  background="transparent"
              />
          </div>
      </div>
    </div>
  );
}