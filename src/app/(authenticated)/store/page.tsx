// src/app/(authenticated)/store/page.tsx

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { StoreClient } from "./store-client";

export default async function StorePage() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    return redirect('/auth/signin');
  }

  const products = await prisma.storeProduct.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const cart = await prisma.cart.findUnique({
    where: { userId: session.user.id },
    include: {
      items: {
        include: { storeProduct: true },
      },
    },
  });

  const cartItems = cart?.items || [];
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return <StoreClient initialProducts={products} initialCartCount={cartCount} />;
}
