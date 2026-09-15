'use client';

import { format } from 'date-fns';
import { OrderHistoryInput, orderHistory, statusLabel } from '@/lib/order-presentation';

interface OrderSummaryCardProps {
    order: OrderHistoryInput & {
        number: number;
        customerName: string;
        customerPhone: string;
        customerSecondPhone?: string | null;
        customerAddress: string;
        customerCity?: string | null;
        product: { name: string; code: string; price: number };
        quantity: number;
        total: number;
        unitPrice?: number | null; deliveryFee?: number | null; prepaidAmount?: number | null; codAmount?: number | null;
        discount?: number;
        notes?: string | null;
        assignedTo?: { name?: string | null } | null;
        shippingProvider?: string | null;
        trackingNumber?: string | null;
        financialInfo?: { shippingCost: number; currency: string } | null;
        royalExpressTracking?: {
            actualDelivery?: Date | string | null;
            estimatedDelivery?: Date | string | null;
            currentStatus: string;
            isException: boolean;
            exceptionDetails?: string | null;
            lastLocationUpdate?: string | null;
        } | null;
    };
}
const money = (value: number, currency = 'LKR') => new Intl.NumberFormat('en-LK', { style: 'currency', currency }).format(value);
const dateLabel = (date: Date | string | null | undefined) => date && !Number.isNaN(new Date(date).getTime()) ? format(new Date(date), 'dd MMM yyyy, h:mm a') : 'Not recorded';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-sm text-foreground break-words [overflow-wrap:anywhere] whitespace-pre-wrap">{children}</dd></div>;
}

export function OrderSummaryCard({ order }: OrderSummaryCardProps) {
    const returnEvents = orderHistory(order).filter(event => /RETURN|RTO/i.test(event.status));
    return (
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30"><h2 className="text-lg font-bold text-foreground">Order #{order.number}</h2><p className="text-sm text-muted-foreground">Complete order record</p></div>
            <div className="p-6 space-y-6">
                <section>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Customer</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Name">{order.customerName || 'Not recorded'}</Field>
                        <Field label="Phone">{order.customerPhone || 'Not recorded'}</Field>
                        <Field label="Second phone">{order.customerSecondPhone || 'Not recorded'}</Field>
                        <Field label="City">{order.customerCity || 'Not recorded'}</Field>
                        <div className="sm:col-span-2"><Field label="Full address">{order.customerAddress || 'Not recorded'}</Field></div>
                    </dl>
                </section>
                <section className="border-t border-border pt-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Product and payment</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Product">{order.product.name} <span className="text-muted-foreground">({order.product.code})</span></Field>
                        <Field label="Quantity">{order.quantity}</Field>
                        <Field label={order.unitPrice == null ? "Current catalog unit price" : "Saved unit price"}>{money(order.unitPrice ?? order.product.price)}</Field>
                        <Field label="Discount">{money(order.discount ?? 0)}</Field>
                        <Field label="Recorded shipping cost">{order.financialInfo ? money(order.financialInfo.shippingCost, order.financialInfo.currency) : 'Not recorded'}</Field>
                        <Field label="Delivery fee">{order.deliveryFee == null ? "Not recorded" : money(order.deliveryFee)}</Field>
                        <Field label="Prepaid amount">{order.prepaidAmount == null ? "Not recorded" : money(order.prepaidAmount)}</Field>
                        <Field label="COD amount">{order.codAmount == null ? "Not recorded separately" : money(order.codAmount)}</Field>
                    </dl>
                    {order.unitPrice == null && <p className="mt-3 text-xs text-muted-foreground">Historical unit price was not recorded. Current catalog price is shown for reference.</p>}
                    <div className="mt-4 border-t border-border pt-4 flex justify-between gap-4 items-baseline"><span className="text-sm font-semibold text-foreground">Order total</span><strong className="text-xl text-primary tabular-nums">{money(order.total)}</strong></div>
                </section>
                <section className="border-t border-border pt-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Fulfilment</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Current status">{statusLabel(order.status)}</Field>
                        <Field label="Assigned staff">{order.assignedTo?.name || 'Not assigned'}</Field>
                        <Field label="Courier">{order.shippingProvider ? statusLabel(order.shippingProvider) : 'Not assigned'}</Field>
                        <Field label="Tracking number">{order.trackingNumber || 'Not recorded'}</Field>
                        <Field label="Created">{dateLabel(order.createdAt)}</Field>
                        <Field label="Shipped">{dateLabel(order.shippedAt)}</Field>
                        <Field label="Delivered">{dateLabel(order.deliveredAt)}</Field>
                    </dl>
                </section>
                {order.royalExpressTracking && (
                    <section className="border-t border-border pt-5">
                        <h3 className="text-sm font-semibold text-foreground mb-1">Historical Royal Express record</h3>
                        <p className="mb-3 text-xs text-muted-foreground">Previously saved courier information.</p>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Recorded courier status">{statusLabel(order.royalExpressTracking.currentStatus)}</Field>
                            <Field label="Recorded actual delivery">{dateLabel(order.royalExpressTracking.actualDelivery)}</Field>
                            <Field label="Recorded delivery estimate">{dateLabel(order.royalExpressTracking.estimatedDelivery)}</Field>
                            <Field label="Last recorded location">{order.royalExpressTracking.lastLocationUpdate || 'Not recorded'}</Field>
                            <div className="sm:col-span-2"><Field label="Recorded exception">{order.royalExpressTracking.exceptionDetails || (order.royalExpressTracking.isException ? 'Exception flagged; details not recorded' : 'None recorded')}</Field></div>
                        </dl>
                    </section>
                )}
                <section className="border-t border-border pt-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Return / RTO information</h3>
                    {returnEvents.length ? <ul className="space-y-3">{returnEvents.map(event => <li key={event.id} className="text-sm text-foreground"><p className="font-medium">{statusLabel(event.status)} · {dateLabel(event.timestamp)}</p><p className="mt-1 text-muted-foreground">{event.description || 'No reason recorded'}{event.location ? ` · ${event.location}` : ''}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">{order.status === 'RETURNED' ? 'Order returned. Return date and reason not recorded.' : 'No return information recorded.'}</p>}
                </section>
                <section className="border-t border-border pt-5"><h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3><p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{order.notes || 'No notes recorded.'}</p></section>
            </div>
        </section>
    );
}
