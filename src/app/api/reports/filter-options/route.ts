import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
export async function GET() {
    const guard = await requirePermission('VIEW_REPORTS'); if (!guard.ok) return guard.response;
    const [products,staff] = await Promise.all([
        prisma.product.findMany({where:{tenantId:guard.tenantId},select:{id:true,name:true,code:true},orderBy:{name:'asc'}}),
        prisma.user.findMany({where:{tenantId:guard.tenantId,role:{not:'SUPER_ADMIN'}},select:{id:true,name:true},orderBy:{name:'asc'}}),
    ]);
    return NextResponse.json({products,staff},{headers:{'Cache-Control':'private, no-store'}});
}
