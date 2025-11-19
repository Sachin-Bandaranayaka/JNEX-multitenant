import { getSession } from "@/lib/auth";
import { getScopedPrismaClient } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { EditProductClient } from "./edit-product-client";
import { User } from "next-auth";

interface EditProductPageProps {
  params: Promise<{ productId: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const session = await getSession();

  if (!session?.user?.tenantId) {
    return redirect('/auth/signin');
  }

  const resolvedParams = await params;
  const prisma = getScopedPrismaClient(session.user.tenantId);

  const canViewPage = session.user.role === 'ADMIN' || session.user.permissions?.includes('VIEW_PRODUCTS');
  if (!canViewPage) {
    return redirect('/unauthorized');
  }

  const [product, stockAdjustments] = await Promise.all([
    prisma.product.findUnique({
      where: { id: resolvedParams.productId },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        lowStockAlert: true,
      }
    }),
    prisma.stockAdjustment.findMany({
      where: { productId: resolvedParams.productId },
      orderBy: { createdAt: 'desc' },
      include: { adjustedBy: { select: { name: true, email: true } } }
    })
  ]);

  if (!product) {
    return notFound();
  }

  // --- FIX: Convert Date objects to strings before passing to client ---
  // This makes the data serializable and matches the type expected by the client component.
  const serializedStockAdjustments = stockAdjustments.map(adjustment => ({
    ...adjustment,
    createdAt: adjustment.createdAt.toISOString(),
  }));

  return (
    <EditProductClient
      product={product}
      stockAdjustments={serializedStockAdjustments} // Pass the corrected data
      user={session.user as User}
    />
  );
}