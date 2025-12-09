// src/app/(authenticated)/store/cart/page.tsx

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CartClient } from "./cart-client";

export default async function CartPage() {
  const session = await getSession();
  
  if (!session?.user?.id) {
    return redirect('/auth/signin');
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: session.user.id },
    include: {
      items: {
        include: { storeProduct: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const items = cart?.items || [];
  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.storeProduct.price,
    0
  );

  return <CartClient initialItems={items} initialTotal={totalAmount} />;
}
