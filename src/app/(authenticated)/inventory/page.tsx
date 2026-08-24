import { getSession } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { InventoryClient } from "./inventory-client";
import { User } from "next-auth"; // Import the User type

export default async function InventoryPage() {
  const session = await getSession();

  if (!session?.user?.tenantId) {
    return redirect('/auth/signin');
  }

  // This permission check correctly secures the page
  if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('VIEW_PRODUCTS')) {
    return redirect('/unauthorized');
  }

  const prisma = getScopedPrismaClient(session.user.tenantId);

  const products = await prisma.product.findMany({
    // --- FIX: Add a 'where' clause to only fetch active products ---
    where: {
      isActive: true,
    },
    orderBy: {
      name: 'asc'
    },
    select: {
      id: true,
      code: true,
      name: true,
      price: true,
      stock: true,
      lowStockAlert: true,
    }
  });

  return <InventoryClient initialProducts={products} user={session.user as User} />;
}
