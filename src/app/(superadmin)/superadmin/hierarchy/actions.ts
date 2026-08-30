'use server';

import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/superadmin-auth';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { TransferResult } from './types';

const transferSchema = z.object({ memberId: z.string().min(1), newReferrerId: z.string().nullable(), reason: z.string().trim().min(10, 'Please provide a reason of at least 10 characters.').max(500) });

export async function transferTenant(input: { memberId: string; newReferrerId: string | null; reason: string }): Promise<TransferResult> {
  try {
    const { actor } = await requireSuperAdmin();
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || 'Check the transfer details.' };
    const { memberId, newReferrerId, reason } = parsed.data;
    if (memberId === newReferrerId) return { ok: false, message: 'A member cannot refer themselves.' };
    const memberName = await prisma.$transaction(async (tx) => {
      const allTenants = await tx.tenant.findMany({ select: { id: true, name: true, isActive: true, referredById: true } });
      const byId = new Map(allTenants.map((tenant) => [tenant.id, tenant]));
      const member = byId.get(memberId);
      if (!member) throw new Error('The member no longer exists. Refresh and try again.');
      const newReferrer = newReferrerId ? byId.get(newReferrerId) : null;
      if (newReferrerId && !newReferrer) throw new Error('The selected referrer no longer exists.');
      if (newReferrer && !newReferrer.isActive) throw new Error('Inactive tenants cannot become a new referrer.');
      if (member.referredById === newReferrerId) throw new Error('Choose a different referrer; this is already the current relationship.');
      const children = new Map<string, string[]>();
      for (const tenant of allTenants) if (tenant.referredById) children.set(tenant.referredById, [...(children.get(tenant.referredById) || []), tenant.id]);
      const descendants = new Set<string>();
      const stack = [...(children.get(memberId) || [])];
      while (stack.length) { const id = stack.pop()!; if (descendants.has(id)) continue; descendants.add(id); stack.push(...(children.get(id) || [])); }
      if (newReferrerId && descendants.has(newReferrerId)) throw new Error('A member cannot be moved under their own downline.');
      const oldReferrer = member.referredById ? byId.get(member.referredById) : null;
      await tx.tenant.update({ where: { id: memberId }, data: { referredById: newReferrerId } });
      await tx.auditEvent.create({ data: { actorId: actor.id, tenantId: member.id, action: 'TENANT_REFERRER_TRANSFERRED', entityType: 'Tenant', entityId: member.id, metadata: { memberName: member.name, oldReferrerId: oldReferrer?.id || null, oldReferrerName: oldReferrer?.name || null, newReferrerId: newReferrer?.id || null, newReferrerName: newReferrer?.name || null, reason, subtreeMoved: true, downlineCount: descendants.size, historicalBusinessReassigned: false } } });
      return member.name;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    revalidatePath('/superadmin/hierarchy'); revalidatePath('/superadmin/audit');
    return { ok: true, message: `${memberName} and their downline were transferred.` };
  } catch (error) {
    console.error('Tenant hierarchy transfer failed:', error);
    return { ok: false, message: error instanceof Error ? error.message : 'The transfer could not be completed.' };
  }
}
