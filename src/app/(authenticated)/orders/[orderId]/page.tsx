import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { ShippingForm } from '@/components/orders/shipping-form';
import { OrderJourneyHeader } from '@/components/orders/order-journey-header';
import { OrderSummaryCard } from '@/components/orders/order-summary-card';
import { Invoice } from '@/components/orders/invoice';
import { PrintButton } from '@/components/orders/print-button';
import { CancelOrderButton } from '@/components/orders/cancel-order-button';
import { OrderDetailInvoiceSection } from '@/components/orders/order-detail-invoice-section';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { FulfillmentProgress } from '@/components/orders/fulfillment-progress';
import { OrderStatusBadge } from '@/components/orders/order-status-badge';

interface OrderDetailsPageProps {
    params: Promise<{
        orderId: string;
    }>;
    searchParams: Promise<{ flow?: string; stage?: string; nextLeadId?: string }>;
}

export default async function OrderDetailsPage({ params, searchParams }: OrderDetailsPageProps) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    const resolvedParams = await params;
    const query = await searchParams;
    const scopedPrisma = getScopedPrismaClient(session.user.tenantId);

    const [order, tenant] = await Promise.all([
        scopedPrisma.order.findUnique({
            where: { id: resolvedParams.orderId },
            include: {
                product: true,
                lead: true,
                assignedTo: true,
                trackingUpdates: { orderBy: { timestamp: 'desc' } },
                statusHistory: { orderBy: { timestamp: 'desc' } },
                financialInfo: true,
                royalExpressTracking: true,
            },
        }),
        globalPrisma.tenant.findUnique({
            where: { id: session.user.tenantId },
            select: {
                id: true,
                name: true,
                businessName: true,
                businessAddress: true,
                businessPhone: true,
                invoicePrefix: true,
                fardaExpressClientId: true,
                fardaExpressApiKey: true,
                transExpressApiKey: true,
                transExpressOrderPrefix: true,
                royalExpressApiKey: true,
                royalExpressOrderPrefix: true
            }
        })
    ]);

    if (!order || !tenant) {
        return notFound();
    }

    const canUpdateShipping = session.user.role === 'ADMIN' || session.user.permissions?.includes('UPDATE_SHIPPING_STATUS');
    const canDeleteOrders = session.user.role === 'ADMIN' || session.user.permissions?.includes('DELETE_ORDERS');
    const invoiceNumber = `${tenant.invoicePrefix || 'INV'}-${order.number}`;
    const isFulfillmentFlow = query.flow === 'fulfillment';
    const fulfillmentStage = order.invoicePrinted || query.stage === 'complete' ? 'complete' : order.trackingNumber || query.stage === 'print' ? 'print' : 'ship';
    const hasCourierConfiguration = Boolean(tenant.fardaExpressApiKey || tenant.transExpressApiKey || tenant.royalExpressApiKey);
    const prerequisites = [
        { label: 'Customer phone', ready: Boolean(order.customerPhone?.trim()) },
        { label: 'Delivery address', ready: Boolean(order.customerAddress?.trim()) },
        { label: hasCourierConfiguration ? 'Courier ready' : 'Manual shipping available', ready: true },
    ];

    return (
        <>
            {/* --- FIX: Section 1 - For Screen View Only --- */}
            {/* This entire div will be hidden when printing */}
            <div className={`print:hidden p-4 sm:p-6 lg:p-8 ${isFulfillmentFlow ? 'space-y-4' : 'space-y-8'}`}>
                {isFulfillmentFlow && <FulfillmentProgress stage={fulfillmentStage} orderId={order.id} prerequisites={prerequisites} nextLeadId={query.nextLeadId} />}
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Link href={isFulfillmentFlow ? '/dashboard' : '/orders'} className="hover:text-primary transition-colors flex items-center gap-1">
                                <ArrowLeftIcon className="h-3 w-3" />
                                {isFulfillmentFlow ? 'Work queue' : 'Back to Pending Orders'}
                            </Link>
                            <span>/</span>
                            <span>Order #{order.number}</span>
                            {order.lead && (
                                <>
                                    <span>/</span>
                                    <Link href={`/leads/${order.lead.id}`} className="hover:text-primary transition-colors">
                                        From Lead →
                                    </Link>
                                </>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">Order Details</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <OrderStatusBadge status={order.status} />
                        {!isFulfillmentFlow && <PrintButton />}
                    </div>
                </div>

                {/* Order Journey Header (New Horizontal Layout) */}
                {!isFulfillmentFlow && <OrderJourneyHeader order={order} />}

                <div className={`grid grid-cols-1 lg:grid-cols-12 ${isFulfillmentFlow ? 'gap-4' : 'gap-8'}`}>
                    {/* Left Column: Invoice/Order Details */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                        <div id="invoice" className={`bg-card border shadow-sm overflow-hidden scroll-mt-6 ${isFulfillmentFlow ? 'rounded-lg' : 'rounded-3xl'} ${isFulfillmentFlow && fulfillmentStage === 'print' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-border'}`}>
                            <OrderDetailInvoiceSection
                                order={order}
                                tenant={tenant}
                                invoiceNumber={invoiceNumber}
                            />
                        </div>
                    </div>

                    {/* Right Column: Actions & History */}
                    <div className="lg:col-span-5 xl:col-span-4 space-y-6">

                        {/* Shipping Information Card */}
                        {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && canUpdateShipping && (
                            <div id="shipping" className={`bg-card border shadow-sm overflow-visible scroll-mt-6 ${isFulfillmentFlow ? 'rounded-lg' : 'rounded-3xl'} ${isFulfillmentFlow && fulfillmentStage === 'ship' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-border'}`}>
                                <div className={`px-6 py-4 border-b border-border bg-muted/30 ${isFulfillmentFlow ? 'rounded-t-lg' : 'rounded-t-3xl'}`}>
                                    <h3 className="text-lg font-bold text-foreground">{isFulfillmentFlow ? 'Next: arrange shipping' : 'Shipping Information'}</h3>
                                </div>
                                <div className="p-6">
                                    <ShippingForm
                                        orderId={order.id}
                                        currentProvider={order.shippingProvider || undefined}
                                        currentTrackingNumber={order.trackingNumber || undefined}
                                        order={{
                                            customerName: order.customerName,
                                            customerPhone: order.customerPhone,
                                            customerSecondPhone: order.customerSecondPhone || undefined,
                                            customerAddress: order.customerAddress,
                                            customerCity: order.shippingCityName || order.customerCity,
                                            product: { name: order.product.name, price: order.product.price, },
                                            quantity: order.quantity,
                                            discount: order.discount || undefined,
                                        }}
                                        fardaExpressClientId={tenant.fardaExpressClientId || undefined}
                                        fardaExpressApiKey={tenant.fardaExpressApiKey || undefined}
                                        transExpressApiKey={tenant.transExpressApiKey || undefined}
                                        royalExpressApiKey={tenant.royalExpressApiKey || undefined}
                                        transExpressOrderPrefix={tenant.transExpressOrderPrefix || undefined}
                                        royalExpressOrderPrefix={tenant.royalExpressOrderPrefix || undefined}
                                        tenantId={tenant.id}
                                        orderNumber={order.number}
                                        guided={isFulfillmentFlow}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Order Summary Card (Replaces old Journey) */}
                        <OrderSummaryCard order={order} />

                        {/* Cancel Order Card */}
                        {order.status === 'CONFIRMED' && canDeleteOrders && (
                            <div className="bg-card rounded-3xl border border-destructive/20 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-border bg-destructive/5">
                                    <h3 className="text-lg font-bold text-destructive">Danger Zone</h3>
                                </div>
                                <div className="p-6 space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        If the customer wants to cancel this order, you can do so here. This action cannot be undone.
                                    </p>
                                    <CancelOrderButton orderId={order.id} orderStatus={order.status} />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- FIX: Section 2 - For Print View Only --- */}
            {/* This div is hidden on screen but becomes the only visible thing when printing */}
            <div className="hidden print:block">
                <Invoice
                    businessName={tenant.businessName}
                    businessAddress={tenant.businessAddress}
                    businessPhone={tenant.businessPhone}
                    invoiceNumber={invoiceNumber}
                    order={order}
                    showPrintControls={false} // Hide the "Mark as Printed" button on the paper copy
                />
            </div>
        </>
    );
}
