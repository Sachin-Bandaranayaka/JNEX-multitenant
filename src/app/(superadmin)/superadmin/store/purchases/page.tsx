// src/app/(superadmin)/superadmin/store/purchases/page.tsx

import { prisma } from '@/lib/prisma';
import { PurchasesManagementClient } from './purchases-management-client';

export default async function SuperAdminPurchasesPage() {
  const purchases = await prisma.storePurchase.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      tenant: { select: { id: true, name: true, businessName: true } },
      items: {
        include: { storeProduct: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return <PurchasesManagementClient initialPurchases={purchases} />;
}
