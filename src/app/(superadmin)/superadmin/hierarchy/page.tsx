// src/app/(superadmin)/superadmin/hierarchy/page.tsx

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { Tenant } from '@prisma/client';

// Define a color palette for the levels, excluding red.
const LEVEL_COLORS = [
  //   '#5A9BD5', // Blue
  //   '#ED7D31', // Orange
  //   '#A5A5A5', // Gray
  //   '#FFC000', // Yellow
  //   '#4472C4', // Darker Blue
  '#70AD47', // Green
];

const DEACTIVATED_COLOR = '#ef4444'; // Red color for inactive tenants

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
      <div className="flex items-center gap-x-3">
        {/* The dot now uses the new color logic */}
        <span
          className="h-2.5 w-2.5 rounded-full ring-0 ring-offset-none "
          style={{
            backgroundColor: dotColor,
            borderColor: dotColor,
          }}
        ></span>
        <span className="text-sm font-medium text-white">{tenant.name}</span>
        <span className="text-xs text-gray-400">({tenant.businessName || 'No Business Name'})</span>
      </div>
      {tenant.referrals && tenant.referrals.length > 0 && (
        <ul className="pl-6 border-l border-gray-700">
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold leading-6 text-white">
          Tenant Referral Hierarchy
        </h1>
        <p className="mt-2 text-sm text-gray-300">
          A visual representation of the tenant referral structure by level.
        </p>
      </div>
      <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
        <ul>
          {topLevelTenants.map((tenant) => (
            // Start the top-level tenants at level 0
            <TenantNode key={tenant.id} tenant={tenant as TenantWithReferrals} level={0} />
          ))}
        </ul>
      </div>
    </div>
  );
}