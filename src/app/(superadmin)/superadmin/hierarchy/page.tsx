// src/app/(superadmin)/superadmin/hierarchy/page.tsx

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { Tenant } from '@prisma/client';
import { Card, EmptyState, PageHeader } from '../ui';

// Define a color palette for the levels, excluding red.
const LEVEL_COLORS = [
  //   '#5A9BD5', // Blue
  //   '#ED7D31', // Orange
  //   '#A5A5A5', // Gray
  //   '#FFC000', // Yellow
  //   '#4472C4', // Darker Blue
  '#3f8f2f', // Green — darkened so it still reads against a white card
];

const DEACTIVATED_COLOR = '#dc2626'; // Red color for inactive tenants

type TenantWithReferrals = Tenant & {
  referrals: TenantWithReferrals[];
};

// The component now accepts a 'level' prop to determine the color
const TenantNode = ({ tenant, level }: { tenant: TenantWithReferrals, level: number }) => {
  // Determine the color: if inactive use red, otherwise use the level color.
  const dotColor = tenant.isActive
    ? LEVEL_COLORS[level % LEVEL_COLORS.length]
    : DEACTIVATED_COLOR;

  return (
    <li className="mt-3 ml-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* The dot now uses the new color logic */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        ></span>
        <span className="text-sm font-semibold text-slate-900">{tenant.name}</span>
        <span className="text-xs text-slate-500">({tenant.businessName || 'No business name'})</span>
        {!tenant.isActive && <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">Inactive</span>}
      </div>
      {tenant.referrals && tenant.referrals.length > 0 && (
        <ul className="border-l border-slate-200 pl-6">
          {tenant.referrals.map((referral) => (
            // Pass the next level down to the children
            <TenantNode key={referral.id} tenant={referral} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};

const recursiveReferralInclude = (depth: number): any => {
  if (depth === 0) return true;
  return { include: { referrals: recursiveReferralInclude(depth - 1) } };
};

export default async function TenantHierarchyPage() {
  const topLevelTenants = await prisma.tenant.findMany({
    where: {
      referredById: null,
    },
    include: {
      referrals: recursiveReferralInclude(5),
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Referral network"
        title="Tenant referral hierarchy"
        description="A visual representation of the tenant referral structure by level."
      />
      <Card flush>
        {topLevelTenants.length ? (
          <ul className="p-5">
            {topLevelTenants.map((tenant) => (
              // Start the top-level tenants at level 0
              <TenantNode key={tenant.id} tenant={tenant as TenantWithReferrals} level={0} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No tenants to chart" description="Referral relationships appear here once tenants are created." />
        )}
      </Card>
    </div>
  );
}
