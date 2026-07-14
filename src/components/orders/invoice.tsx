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
    // The final amount charged at the time of sale (unit price × qty − discount),
    // frozen when the order was created. Invoices must use this, NOT the live
    // product price, so a later catalog price change never alters past invoices.
    total: number;
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

    // Use the sale-time total frozen on the order, not the live product price.
    // order.total already has the discount subtracted, so reconstruct the
    // pre-discount line amount from it for display.
    const discount = order.discount || 0;
    const total = Math.max(0, order.total);
    const subtotal = total + discount;

    const commonInvoice = (
        <div className={`w-full bg-white text-black ${isMultiPrint ? 'p-1' : 'px-2 p-4'} rounded relative`}>
            <div className={`flex justify-between ${isMultiPrint ? 'mb-1' : 'mb-2'}`}>
                <div className="text-left">
                    <h1 className={`${isMultiPrint ? 'text-[7pt]' : 'text-[9pt]'} font-bold leading-tight`}>{businessName || 'Your Company Name'}</h1>
                    <div className={`${isMultiPrint ? 'text-[5.5pt]' : 'text-[7pt]'} text-gray-600 leading-tight`}>
                        <p>{businessAddress || 'Your Company Address'}</p>
                        <p>Tel: {businessPhone || 'Your Phone'}</p>
                    </div>
                    <div className={`${isMultiPrint ? 'text-[5.5pt]' : 'text-[7pt]'} leading-tight mt-1`}>
                        <p>Invoice #: {invoiceNumber}</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className={`${isMultiPrint ? 'text-[9pt] leading-tight' : 'text-[13pt] leading-snug'} font-semibold`}>
                        <p>To: <span className="font-bold">{order.customerName}</span></p>
                        <p className="font-bold">{order.customerAddress}</p>
                        <p>Tel: <span className="font-bold">{order.customerPhone}</span></p>
                        {order.customerSecondPhone && (
                            <p>Secondary Tel: <span className="font-bold">{order.customerSecondPhone}</span></p>
                        )}
                    </div>
                </div>
            </div>

            <table className={`w-full ${isMultiPrint ? 'text-[5.25pt]' : 'text-[7pt]'} mb-0.5 leading-tight`}>
                <thead>
                    <tr>
                        <th className="py-0.5 text-left">Item</th>
                        <th className="py-0.5 text-right">Qty</th>
                        <th className="py-0.5 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className={`py-0.5 ${isMultiPrint ? 'font-bold' : ''}`}>{order.product.name}</td>
                        <td className={`py-0.5 text-right ${isMultiPrint ? 'font-bold' : ''}`}>{order.quantity}</td>
                        {/* No discount: the line amount IS the total, so show it once, in bold */}
                        <td className={`py-0.5 text-right ${isMultiPrint ? 'font-bold' : discount > 0 ? '' : 'font-bold text-[8pt]'}`}>
                            {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(discount > 0 ? subtotal : total)}
                        </td>
                    </tr>
                </tbody>
                {discount > 0 && (
                    <tfoot>
                        <tr>
                            <td colSpan={2} className="py-0.5 text-right">Discount:</td>
                            <td className="py-0.5 text-right">
                                -{new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(discount)}
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} className={`py-0.5 text-right font-bold ${isMultiPrint ? 'text-[6pt]' : 'text-[8pt]'}`}>Total:</td>
                            <td className={`py-0.5 text-right font-bold ${isMultiPrint ? 'text-[6pt]' : 'text-[8pt]'}`}>
                                {new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(total)}
                            </td>
                        </tr>
                    </tfoot>
                )}
            </table>

            {/* --- NEW: Barcode Section --- */}
            {order.shippingProvider && order.trackingNumber && (
                <div className={`text-left ${isMultiPrint ? 'mt-0.5' : 'mt-2'}`}>
                    <p className={`${isMultiPrint ? 'text-[6.5pt]' : 'text-[8pt]'}`}>
                        {order.shippingProvider.replace('_', ' ')} - {order.trackingNumber}
                    </p>
                    <div className={`flex justify-start ${isMultiPrint ? 'mt-0.5' : 'mt-1'}`}>
                        <Barcode
                            value={order.trackingNumber}
                            height={isMultiPrint ? 20 : 40}
                            fontSize={isMultiPrint ? 7 : 8}
                            width={1}
                            margin={0}
                            background="transparent"
                        />
                    </div>
                </div>
            )}

            {!isMultiPrint && order.notes && (
                <div className={`text-left ${isMultiPrint ? 'mt-0.5 pt-0.5' : 'my-1 pt-1'}`}>
                    <p className={`${isMultiPrint ? 'text-[6.5pt]' : 'text-[8pt]'}`}>
                        <span className="font-medium">Notes: </span>
                        <span>{order.notes}</span>
                    </p>
                </div>
            )}

            <div className={`flex justify-between items-end ${isMultiPrint ? 'mt-0.5' : 'mt-1'}`}>
                <p className={`${isMultiPrint ? 'text-[6.5pt]' : 'text-[8pt]'}`}>Thank you!</p>
                {printIndex !== undefined && (
                    <div className={`bg-black text-white font-bold rounded-full print:border print:border-black print:bg-white print:text-black ${isMultiPrint ? 'text-[6.5pt] px-1.5 py-0.5' : 'text-xs px-2 py-1'}`}>
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
