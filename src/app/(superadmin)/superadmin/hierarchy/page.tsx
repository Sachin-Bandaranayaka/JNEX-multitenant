export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { PageHeader, Stat } from '../ui';
import { HierarchyWorkspace } from './hierarchy-workspace';
import type { HierarchyTenant, TransferHistoryItem } from './types';

function text(value: unknown) { return typeof value === 'string' ? value : null; }

export default async function TenantHierarchyPage() {
  const [tenants, events] = await Promise.all([
    prisma.tenant.findMany({ orderBy: [{ name: 'asc' }], select: { id: true, name: true, businessName: true, isActive: true, referredById: true } }),
    prisma.auditEvent.findMany({ where: { action: 'TENANT_REFERRER_TRANSFERRED' }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, createdAt: true, metadata: true, actor: { select: { name: true, email: true } } } }),
  ]);
  const tenantRows: HierarchyTenant[] = tenants;
  const ids = new Set(tenants.map((tenant) => tenant.id));
  const roots = tenants.filter((tenant) => !tenant.referredById || !ids.has(tenant.referredById));
  const children = new Map<string, string[]>();
  for (const tenant of tenants) if (tenant.referredById) children.set(tenant.referredById, [...(children.get(tenant.referredById) || []), tenant.id]);
  let maximumDepth = 0;
  const visited = new Set<string>();
  const visit = (id: string, depth: number) => { if (visited.has(id)) return; visited.add(id); maximumDepth = Math.max(maximumDepth, depth); for (const childId of children.get(id) || []) visit(childId, depth + 1); };
  for (const root of roots) visit(root.id, 0);
  for (const tenant of tenants) if (!visited.has(tenant.id)) visit(tenant.id, 0);

  const history: TransferHistoryItem[] = events.map((event) => {
    const metadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata as Record<string, unknown> : {};
    return { id: event.id, createdAt: event.createdAt.toISOString(), memberName: text(metadata.memberName) || 'Unknown tenant', fromName: text(metadata.oldReferrerName), toName: text(metadata.newReferrerName), reason: text(metadata.reason), actorName: event.actor.name || event.actor.email };
  });

  return <div className="space-y-6">
    <PageHeader title="Referral tree" description="Who referred whom. You can move a tenant (and everyone they referred) under a different referrer." />
    <section aria-label="Hierarchy summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Total tenants" value={tenants.length} hint="Across the full network" />
      <Stat label="Top-level tenants" value={roots.length} hint="Not referred by anyone" />
      <Stat label="Active tenants" value={tenants.filter((tenant) => tenant.isActive).length} hint={`${tenants.filter((tenant) => !tenant.isActive).length} inactive`} tone="good" />
      <Stat label="Deepest chain" value={maximumDepth} hint={maximumDepth === 1 ? '1 level of referrals' : `${maximumDepth} levels of referrals`} />
    </section>
    <HierarchyWorkspace tenants={tenantRows} history={history} />
  </div>;
}
