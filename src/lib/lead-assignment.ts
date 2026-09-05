// src/lib/lead-assignment.ts
//
// Audit trail for who handed which lead to whom. Reassignment changes who can
// see a customer's details, so it belongs in the same log as the staff-account
// changes.

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

export async function recordLeadAssignment(event: {
  actorId: string;
  tenantId: string;
  leadIds: readonly string[];
  assigneeId: string | null;
}) {
  if (event.leadIds.length === 0) return;

  try {
    const { headers } = await import('next/headers');
    const { getRequestIdentity } = await import('./impersonation');
    const identity = getRequestIdentity(await headers());

    await prisma.auditEvent.create({
      data: {
        actorId: event.actorId,
        tenantId: event.tenantId,
        action: event.assigneeId ? 'LEADS_ASSIGNED' : 'LEADS_UNASSIGNED',
        entityType: 'Lead',
        // A bulk reassignment is one decision, so it is one event; the leads it
        // covered are in the metadata.
        entityId: event.leadIds.length === 1 ? event.leadIds[0] : null,
        metadata: {
          leadIds: [...event.leadIds],
          leadCount: event.leadIds.length,
          assigneeId: event.assigneeId,
        } as Prisma.InputJsonValue,
        ...identity,
      },
    });
  } catch (error) {
    // Never let the audit write be the reason an assignment fails.
    console.error('Failed to record lead assignment:', error);
  }
}
