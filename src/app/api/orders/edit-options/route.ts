import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
export const dynamic = 'force-dynamic';
export async function GET() {
  const guard = await requirePermission('EDIT_ORDERS');
  if (!guard.ok) return guard.response;
  const [products, staff] = await Promise.all([
    prisma.product.findMany({ where: { tenantId: guard.tenantId, isActive: true }, select: { id: true, name: true, code: true, price: true, stock: true }, orderBy: { name: 'asc' } }),
    guard.session.user.role === 'ADMIN' ? prisma.user.findMany({ where: { tenantId: guard.tenantId, isActive: true, role: { not: 'SUPER_ADMIN' } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : [],
  ]);
  return NextResponse.json({ products, staff }, { headers: { 'Cache-Control': 'private, no-store' } });
}
