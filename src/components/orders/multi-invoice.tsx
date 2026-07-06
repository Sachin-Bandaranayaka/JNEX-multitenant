'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Invoice } from './invoice';

interface Product {
    id: string;
    name: string;
    code: string;
    price: number;
}

interface Order {
    id: string;
    createdAt: Date;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    product: Product;
    quantity: number;
    discount: number;
    total: number;
    shippingProvider?: string | null;
    trackingNumber?: string | null;
}

interface MultiInvoiceProps {
    orders: Order[];
}

export function MultiInvoice({ orders }: MultiInvoiceProps) {
    // Calculate total number of invoices
    const totalInvoices = orders.length;

    return (
        <div className="w-full print:a4">
            <div className="grid grid-cols-1 gap-0 print:gap-0">
                {/* Split orders into groups of 8 */}
                {chunk(orders, 8).map((orderGroup, pageIndex) => (
                    <div
                        key={pageIndex}
                        className="w-full min-h-[180mm] print:h-[180mm] relative page-break-after-always"
                        style={{
                            pageBreakAfter: 'always',
                            pageBreakBefore: pageIndex > 0 ? 'always' : 'auto',
                            breakAfter: 'page',
                            breakBefore: pageIndex > 0 ? 'page' : 'auto',
                            breakInside: 'avoid'
                        }}
                    >
                        <div className="grid grid-cols-2 gap-0 h-full">
                            {orderGroup.map((order, groupIndex) => {
                                // Calculate the actual invoice number based on page and position
                                const invoiceNumber = pageIndex * 8 + groupIndex + 1;

                                return (
                                    <div
                                        key={order.id}
                                        className="h-[45mm] py-0 px-1 flex items-start justify-start border-r border-b border-gray-700 last:border-b-0 even:border-r-0 print:border-black"
                                    >
                                        <Invoice
                                            businessName="Your Company"
                                            businessAddress="Your Address"
                                            businessPhone="Your Phone"
                                            order={order}
                                            isMultiPrint={true}
                                            invoiceNumber={String(invoiceNumber)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Helper function to split array into chunks
function chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Helper function to format currency
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
    }).format(amount);
}