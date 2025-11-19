'use client';

import { format } from 'date-fns';
import Barcode from 'react-barcode';
import { InvoicePrintButton } from './invoice-print-button';

// Interfaces for props
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

interface InvoiceProps {
    order: Order;
    businessName: string | null;
    businessAddress: string | null;
    businessPhone: string | null;
    invoiceNumber: string;
    isMultiPrint?: boolean;
    showPrintControls?: boolean;
    printIndex?: number;
}

export function Invoice({
    order,
    businessName,
    businessAddress,
    businessPhone,
    invoiceNumber,
    isMultiPrint = false,
    showPrintControls = false,
    printIndex,
}: InvoiceProps) {

    const subtotal = order.product.price * order.quantity;
    const discount = order.discount || 0;
    const total = Math.max(0, subtotal - discount);

    const commonInvoice = (
        <div className="w-full px-2 bg-white text-black p-4 rounded rounded-2 relative">
            <div className="flex justify-between mb-2">
                <div className="text-left">
                    <h1 className={`${isMultiPrint ? 'text-[9pt]' : 'text-[12pt]'} font-bold leading-tight`}>{businessName || 'Your Company Name'}</h1>
                    <div className={`${isMultiPrint ? 'text-[6.5pt]' : 'text-[8pt]'} text-gray-600 leading-tight`}>
                        <p>{businessAddress || 'Your Company Address'}</p>
                        <p>Tel: {businessPhone || 'Your Phone'}</p>
                    </div>
                    <div className={`${isMultiPrint ? 'text-[6.5pt]' : 'text-[8pt]'} leading-tight mt-1`}>
                        <p>Invoice #: {invoiceNumber}</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className={`${isMultiPrint ? 'text-[7.5pt]' : 'text-[10pt]'} leading-tight`}>
                        <p>To: <span className="font-bold">{order.customerName}</span></p>
                        <p className="font-bold">{order.customerAddress}</p>
                        <p>Tel: <span className="font-bold">{order.customerPhone}</span></p>
                        {order.customerSecondPhone && (
                            <p>Secondary Tel: <span className="font-bold text-blue-600">{order.customerSecondPhone}</span></p>
                        )}
                    </div>
                </div>
            </div>

            <table className={`w-full ${isMultiPrint ? 'text-[6.5pt]' : 'text-[8pt]'} mb-0.5 leading-tight`}>
                <thead>
                    <tr className="border-t border-b border-gray-400">
                        <th className="py-0.5 text-left">Item</th>
                        <th className="py-0.5 text-right">Qty</th>
                        <th className="py-0.5 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="py-0.5">{order.product.name}</td>
                        <td className="py-0.5 text-right">{order.quantity}</td>
                        <td className="py-0.5 text-right">
                            {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(subtotal)}
                        </td>
                    </tr>
                </tbody>
                <tfoot>
                    {discount > 0 && (
                        <tr>
                            <td colSpan={2} className="py-0.5 text-right">Discount:</td>
                            <td className="py-0.5 text-right">
                                -{new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(discount)}
                            </td>
                        </tr>
                    )}
                    <tr className="border-t border-gray-400">
                        <td colSpan={2} className="py-0.5 text-right font-bold">Total:</td>
                        <td className="py-0.5 text-right font-bold">
                            {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(total)}
                        </td>
                    </tr>
                </tfoot>
            </table>

            {/* --- NEW: Barcode Section --- */}
            {order.shippingProvider && order.trackingNumber && (
                <div className="text-left mt-2">
                    <p className={`${isMultiPrint ? 'text-[7pt]' : 'text-[8pt]'}`}>
                        {order.shippingProvider.replace('_', ' ')} - {order.trackingNumber}
                    </p>
                    <div className="flex justify-start mt-1">
                        <Barcode
                            value={order.trackingNumber}
                            height={isMultiPrint ? 25 : 40}
                            fontSize={isMultiPrint ? 7 : 8}
                            width={1}
                            margin={0}
                            background="transparent"
                        />
                    </div>
                </div>
            )}

            {order.notes && (
                <div className="text-left my-1 border-t border-gray-400 pt-1">
                    <p className={`${isMultiPrint ? 'text-[7pt]' : 'text-[8pt]'} font-medium`}>Notes:</p>
                    <p className={`${isMultiPrint ? 'text-[7pt]' : 'text-[8pt]'}`}>{order.notes}</p>
                </div>
            )}

            <div className="flex justify-between items-end mt-1">
                <p className={`${isMultiPrint ? 'text-[7pt]' : 'text-[8pt]'}`}>Thank you!</p>
                {printIndex !== undefined && (
                    <div className="bg-black text-white text-xs font-bold px-2 py-1 rounded-full print:border print:border-black print:bg-white print:text-black">
                        #{printIndex}
                    </div>
                )}
            </div>
        </div>
    );

    if (isMultiPrint) {
        return <div className="w-full">{commonInvoice}</div>;
    }

    return (
        <div className="max-w-[80mm] mx-auto p-2 bg-white text-black">
            {commonInvoice}
            {showPrintControls && !isMultiPrint && (
                <div className="mt-4 print:hidden">
                    <InvoicePrintButton
                        orderId={order.id}
                        isPrinted={order.invoicePrinted || false}
                    />
                </div>
            )}
        </div>
    );
}
