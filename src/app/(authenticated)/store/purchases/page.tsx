// src/app/(authenticated)/store/purchases/page.tsx

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PurchasesClient } from "./purchases-client";

export default async function PurchasesPage() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    return redirect('/auth/signin');
  }

  const purchases = await prisma.storePurchase.findMany({
    where: { userId: session.user.id },
    include: {
      items: {
        include: { storeProduct: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return <PurchasesClient initialPurchases={purchases} />;
}
