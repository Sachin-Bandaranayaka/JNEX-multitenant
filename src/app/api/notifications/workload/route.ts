import { NextResponse } from 'next/server';
import { requireAnyPermission } from '@/lib/authz';
import { can } from '@/lib/permissions';
import { getScopedPrismaClient } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAnyPermission(['VIEW_LEADS', 'VIEW_PRODUCTS']);
  if (!guard.ok) return guard.response;
  const { tenantId, session } = guard;
  const prisma = getScopedPrismaClient(tenantId);
  const assigned = session.user.role === 'TEAM_MEMBER';
  const ownership = assigned ? { userId: session.user.id } : {};
  const viewLeads = can(session.user, 'VIEW_LEADS');
  try {
    const [pendingLeads, dueReminders, lowStockProducts] = await Promise.all([
      viewLeads ? prisma.lead.count({ where: { tenantId, status: 'PENDING', ...ownership } }) : null,
      viewLeads ? prisma.leadReminder.count({ where: {
        tenantId, status: 'PENDING', remindAt: { lte: new Date() },
        lead: { tenantId, status: { in: ['PENDING', 'NO_ANSWER'] }, ...ownership },
      } }) : null,
      can(session.user, 'VIEW_PRODUCTS') ? prisma.product.count({ where: {
        tenantId, isActive: true, stock: { lte: prisma.product.fields.lowStockAlert },
      } }) : null,
    ]);
    return NextResponse.json({ pendingLeads, dueReminders, lowStockProducts, scope: assigned ? 'assigned' : 'tenant' }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load current workload.' }, { status: 503 });
  }
}
