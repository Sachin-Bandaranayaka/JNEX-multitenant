// src/app/(authenticated)/shipping/page.tsx

import { getScopedPrismaClient } from '@/lib/prisma'; // <-- Import our scoped client
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import { Prisma } from '@prisma/client';

export default async function ShippingTrackingPage() {
    const session = await getServerSession(authOptions);

    // 1. Secure the page and get the tenantId
    if (!session?.user?.tenantId) {
        return redirect('/auth/signin');
    }

    // 2. Use the scoped client
    const prisma = getScopedPrismaClient(session.user.tenantId);

    // 3. Build a secure WHERE clause
    const where: Prisma.OrderWhereInput = {
        status: 'SHIPPED',
        shippingProvider: { not: null },
        trackingNumber: { not: null },
        // If the user is a TEAM_MEMBER, they only see their own shipped orders.
        // An ADMIN will see all shipped orders for their tenant (handled by the scoped client).
        ...(session.user.role === 'TEAM_MEMBER' && { userId: session.user.id }),
    };

    // 4. This query is now SECURE. It only finds orders matching the criteria
    // for the logged-in user's tenant.
    const shippedOrders = await prisma.order.findMany({
        where,
        include: {
            product: true,
            assignedTo: true,
        },
        orderBy: {
            shippedAt: 'desc',
        },
    });

    const getTrackingUrl = (provider: string, trackingNumber: string) => {
        switch (provider) {
            case 'FARDA_EXPRESS':
                return `https://farda-express.com/track?id=${trackingNumber}`;
            case 'TRANS_EXPRESS':
                return `https://trans-express.net/track/${trackingNumber}`;
            case 'SL_POST':
                return `https://posta.lk/tracking?id=${trackingNumber}`;
            case 'ROYAL_EXPRESS':
                return `https://royal-express.lk/track/${trackingNumber}`;
            default:
                return '#';
        }
    };

    const formatProviderName = (provider: string) => {
        return provider.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    };
    
    // --- NO UI CHANGES BELOW THIS LINE ---

    return (
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Shipping Tracking</h1>
                    <p className="mt-2 text-sm text-gray-600">Track all your shipped orders in one place</p>
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-lg">
                <ul className="divide-y divide-gray-200">
                    {shippedOrders.map((order) => (
                        <li key={order.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/60">
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <p className="text-sm font-medium text-indigo-600 truncate">
                                            <Link href={`/orders/${order.id}`} className="hover:text-indigo-800">
                                                Order #{order.id}
                                            </Link>
                                        </p>
                                        <p className="mt-1 text-sm text-gray-700">
                                            {order.customerName} • {order.product.name}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <p className="text-sm text-gray-500">
                                            Shipped: {format(new Date(order.shippedAt!), 'PPp')}
                                        </p>
                                        <div className="mt-1 flex items-center space-x-2">
                                            <span className="text-sm text-gray-500">
                                                {formatProviderName(order.shippingProvider!)}
                                            </span>
                                            <a
                                                href={getTrackingUrl(order.shippingProvider!, order.trackingNumber!)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                                            >
                                                Track #{order.trackingNumber}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 sm:flex sm:justify-between">
                                    <div className="sm:flex">
                                        <p className="flex items-center text-sm text-gray-500">
                                            Assigned to: {order.assignedTo.name}
                                        </p>
                                    </div>
                                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                        <p>
                                            {order.customerAddress}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {shippedOrders.length === 0 && (
                        <li>
                            <div className="px-4 py-8 text-center text-gray-400">
                                No shipped orders found
                            </div>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}