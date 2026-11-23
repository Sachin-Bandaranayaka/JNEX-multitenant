// What is waiting on the owner right now. The sidebar badges and the home
// page's to-do list both read from here, so the two can never disagree.

import { OrderStatus, TenantInvoiceStatus, TopUpStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type PendingCounts = {
  topUps: number;
  invoicePayments: number;
  stockRequests: number;
  storePurchases: number;
};

/** Cheap counts for the sidebar badges — runs on every page load. */
export async function pendingCounts(): Promise<PendingCounts> {
  const [topUps, invoicePayments, stockRequests, storePurchases] = await Promise.all([
    prisma.creditTopUp.count({ where: { status: TopUpStatus.PENDING } }),
    prisma.tenantInvoicePayment.count({ where: { status: 'PENDING' } }),
    // The stock-request table may not be migrated yet on every database; the
    // review page itself handles that case, so a missing table is just zero.
    prisma.stockChangeRequest.count({ where: { status: 'PENDING' } }).catch(() => 0),
    prisma.storePurchase.count({ where: { status: 'PENDING' } }),
  ]);
  return { topUps, invoicePayments, stockRequests, storePurchases };
}

/** Everything on the home page's to-do list, including the heavier checks. */
export async function attentionSummary() {
  const [pending, unbilledDeliveries, unpaidInvoices] = await Promise.all([
    pendingCounts(),
    prisma.order.count({ where: { status: OrderStatus.DELIVERED, deliveryCharge: null } }),
    prisma.tenantInvoice.count({ where: { status: TenantInvoiceStatus.ISSUED } }),
  ]);
  return { ...pending, unbilledDeliveries, unpaidInvoices };
}
