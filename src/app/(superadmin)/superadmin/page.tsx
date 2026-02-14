// src/app/(superadmin)/superadmin/page.tsx

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { ChartCard } from './chart-card';
import { ReferralChart } from './referral-chart'; // <-- Import the new chart

export default async function SuperAdminDashboardPage() {
  // --- STATS DATA FETCHING ---
  const activeTenants = await prisma.tenant.count({ where: { isActive: true } });
  const inactiveTenants = await prisma.tenant.count({ where: { isActive: false } });
  const totalTenants = activeTenants + inactiveTenants;

  const tenantStatusData = [
    { name: 'Active', value: activeTenants, fill: '#22c55e' },
    { name: 'Inactive', value: inactiveTenants, fill: '#ef4444' },
  ];

  // --- NEW REFERRAL DATA FETCHING ---
  const tenantReferrals = await prisma.tenant.findMany({
    // Only include tenants who have referred at least one other tenant
    where: {
      referrals: {
        some: {}
      }
    },
    select: {
      name: true,
      _count: {
        select: {
          referrals: true,
        },
      },
    },
    orderBy: {
      referrals: {
        _count: 'desc',
      },
    },
    take: 10, // Limit to top 10 referrers
  });

  // Transform the data into the format our chart needs
  const referralChartData = tenantReferrals.map(tenant => ({
    name: tenant.name,
    referrals: tenant._count.referrals,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold leading-6 text-white">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-300">An overview of the entire system.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Total Tenants</div>
          <div className="mt-2 text-3xl font-semibold text-white">{totalTenants}</div>
        </div>
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Active Tenants</div>
          <div className="mt-2 text-3xl font-semibold text-green-400">{activeTenants}</div>
        </div>
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <div className="text-sm font-medium text-gray-400">Inactive Tenants</div>
          <div className="mt-2 text-3xl font-semibold text-red-400">{inactiveTenants}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Existing Tenant Status Chart */}
        <ChartCard data={tenantStatusData} />
        {/* --- NEW REFERRAL CHART --- */}
        <ReferralChart data={referralChartData} />
      </div>
    </div>
  );
}