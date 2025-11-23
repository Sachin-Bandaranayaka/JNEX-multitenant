import { getScopedPrismaClient, prisma as globalPrisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { notFound, redirect } from 'next/navigation';
import { ShippingForm } from '@/components/orders/shipping-form';
import { OrderJourney } from '@/components/orders/order-journey';
import { Invoice } from '@/components/orders/invoice';
import { PrintButton } from '@/components/orders/print-button';
import { CancelOrderButton } from '@/components/orders/cancel-order-button';
import { OrderDetailInvoiceSection } from '@/components/orders/order-detail-invoice-section';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface OrderDetailsPageProps {
    params: Promise<{
        orderId: string;
    }>;
}

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    const resolvedParams = await params;
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

    return (
        <>
            {/* --- FIX: Section 1 - For Screen View Only --- */}
            {/* This entire div will be hidden when printing */}
            <div className="print:hidden p-4 sm:p-6 lg:p-8 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Link href="/orders" className="hover:text-primary transition-colors flex items-center gap-1">
                                <ArrowLeftIcon className="h-3 w-3" />
                                Back to Orders
                            </Link>
                            <span>/</span>
                            <span>Order #{order.number}</span>
                        </div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">Order Details</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm ${order.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-1 ring-yellow-500/20' :
                                order.status === 'SHIPPED' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20' :
                                    order.status === 'DELIVERED' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20' :
                                        order.status === 'RETURNED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20' :
                                            'bg-gray-500/10 text-gray-600 dark:text-gray-400 ring-1 ring-gray-500/20'
                            }`}>
                            {order.status}
                        </span>
                        <PrintButton />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    {/* Left Column: Invoice/Order Details */}
                    <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
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
                            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-border bg-muted/30">
                                    <h3 className="text-lg font-bold text-foreground">Shipping Information</h3>
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
                                            product: { name: order.product.name, price: order.product.price, },
                                            quantity: order.quantity,
                                            discount: order.discount || undefined,
                                        }}
                                        fardaExpressClientId={tenant.fardaExpressClientId || undefined}
                                        fardaExpressApiKey={tenant.fardaExpressApiKey || undefined}
                                        transExpressApiKey={tenant.transExpressApiKey || undefined}
                                        royalExpressApiKey={tenant.royalExpressApiKey || undefined}
                                        royalExpressOrderPrefix={tenant.royalExpressOrderPrefix || undefined}
                                        tenantId={tenant.id}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Order Journey Card */}
                        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-border bg-muted/30">
                                <h3 className="text-lg font-bold text-foreground">Order Journey</h3>
                            </div>
                            <div className="p-6">
                                <OrderJourney order={order} />
                            </div>
                        </div>

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