// src/app/(superadmin)/superadmin/store/page.tsx

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { StoreManagementClient } from './store-management-client';

export default async function SuperAdminStorePage() {
  const [products, pendingPurchases] = await Promise.all([
    prisma.storeProduct.findMany({
      orderBy: { createdAt: 'desc' },
    }),
    prisma.storePurchase.count({
      where: { status: 'PENDING' },
    }),
  ]);

  return <StoreManagementClient initialProducts={products} pendingCount={pendingPurchases} />;
}
