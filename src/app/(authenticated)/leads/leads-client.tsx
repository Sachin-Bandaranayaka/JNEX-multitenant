// src/app/(authenticated)/leads/leads-client.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { LeadActions } from '@/components/leads/lead-actions';
import { SearchLeads } from '@/components/leads/search-leads';
import type { LeadWithDetails } from './page';
import { User } from 'next-auth';

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', border: 'border-yellow-500/50', text: 'text-yellow-700 dark:text-yellow-300', icon: '🕒' },
  NO_ANSWER: { label: 'No Answer', border: 'border-orange-500/50', text: 'text-orange-700 dark:text-orange-300', icon: '📞' },
  REJECTED: { label: 'Rejected', border: 'border-red-500/50', text: 'text-red-700 dark:text-red-300', icon: '❌' },
  CONFIRMED: { label: 'Converted', border: 'border-green-500/50', text: 'text-green-700 dark:text-green-300', icon: '✅' },
};

export function LeadsClient({
  initialLeads,
  user,
  searchParams,
  tenantConfig
}: {
  initialLeads: LeadWithDetails[],
  user: User,
  searchParams: { [key: string]: string | string[] | undefined },
  tenantConfig?: {
    fardaExpressClientId?: string;
    fardaExpressApiKey?: string;
    transExpressApiKey?: string;
    royalExpressApiKey?: string;
    royalExpressOrderPrefix?: string;
  }
}) {
  // --- PERMISSION CHECKS ---
  const canCreate = user.role === 'ADMIN' || user.permissions?.includes('CREATE_LEADS');

  // --- STATE AND FILTERING LOGIC ---
  const [leads, setLeads] = useState<LeadWithDetails[]>(initialLeads);
  const timeFilter = (searchParams.timeFilter as string) || 'daily';
  const searchQuery = (searchParams.query as string) || '';

  const refreshLeads = async () => {
    const response = await fetch('/api/leads');
    if (response.ok) {
      const data = await response.json();
      setLeads(data);
    }
  };

  const now = new Date();
  const startDate = new Date();
  switch (timeFilter) {
    case 'weekly': startDate.setDate(now.getDate() - 7); break;
    case 'monthly': startDate.setMonth(now.getMonth() - 1); break;
    default: startDate.setHours(0, 0, 0, 0); break;
  }

  const filteredLeads = leads.filter(lead => {
    const leadDate = new Date(lead.createdAt);
    // Keep PENDING leads regardless of time filter
    const matchesTimeFilter = lead.status === 'PENDING' || (leadDate >= startDate && leadDate <= now);

    if (searchQuery) {
      const csvData = lead.csvData as any;
      const name = csvData.name || '';
      const phone = csvData.phone || '';
      const searchLower = searchQuery.toLowerCase();
      return matchesTimeFilter && (
        name.toLowerCase().includes(searchLower) ||
        phone.toLowerCase().includes(searchLower) ||
        lead.product.name.toLowerCase().includes(searchLower)
      );
    }
    return matchesTimeFilter;
  });

  const leadsByStatus = filteredLeads.reduce((acc, lead) => {
    acc[lead.status] = acc[lead.status] || [];
    acc[lead.status].push(lead);
    return acc;
  }, {} as Record<string, LeadWithDetails[]>);


  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 bg-background text-foreground">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage your leads and track their status.</p>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:space-x-4">
            <div className="flex space-x-2">
              <Link href={`/leads?timeFilter=daily${searchQuery ? `&query=${searchQuery}` : ''}`} className={`px-3 py-1.5 rounded-md text-sm font-medium ${timeFilter === 'daily' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground bg-muted hover:bg-accent'}`}>Daily</Link>
              <Link href={`/leads?timeFilter=weekly${searchQuery ? `&query=${searchQuery}` : ''}`} className={`px-3 py-1.5 rounded-md text-sm font-medium ${timeFilter === 'weekly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground bg-muted hover:bg-accent'}`}>Weekly</Link>
              <Link href={`/leads?timeFilter=monthly${searchQuery ? `&query=${searchQuery}` : ''}`} className={`px-3 py-1.5 rounded-md text-sm font-medium ${timeFilter === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground bg-muted hover:bg-accent'}`}>Monthly</Link>
            </div>
            <div className="mt-4 sm:mt-0"><SearchLeads /></div>
          </div>
        </div>

        {/* --- PERMISSION-BASED BUTTONS --- */}
        {canCreate && (
          <div className="flex gap-4 flex-shrink-0">
            <Link href="/leads/import" className="inline-flex items-center px-4 py-2 border border-input rounded-md ring-1 ring-border text-sm font-medium text-muted-foreground bg-card hover:bg-accent hover:text-accent-foreground">Import CSV</Link>
            <Link href="/leads/new" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md ring-1 ring-border text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90">Add Lead</Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className={`rounded-lg ring-1 ring-border overflow-hidden bg-card border ${config.border}`}>
            <div className="px-6 py-4 border-b border-border">
              <h2 className={`text-lg font-medium flex items-center space-x-2 ${config.text}`}>
                <span>{config.icon}</span>
                <span>{config.label} ({leadsByStatus[status]?.length || 0})</span>
              </h2>
            </div>
            <ul className="divide-y divide-border">
              {(leadsByStatus[status] || []).map((lead) => (
                <li key={lead.id} className="p-4 hover:bg-accent/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-grow">
                      <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-primary hover:text-primary/80">
                        {(lead.csvData as any).name || 'Unnamed Lead'}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">{lead.product.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">📞 {(lead.csvData as any).phone}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-sm text-muted-foreground">{format(new Date(lead.createdAt), 'MMM d, p')}</p>
                      {lead.assignedTo && <p className="mt-1 text-xs text-muted-foreground">To: {lead.assignedTo.name}</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {lead.status === 'CONFIRMED' && lead.order ?
                      (<p className="text-sm text-green-600 dark:text-green-400">🛍️ Order #{lead.order.id}</p>) :
                      (<div />) // Placeholder for alignment
                    }
                    {/* --- PASS PROPS TO ACTION COMPONENT --- */}
                    <LeadActions lead={lead} user={user} onAction={refreshLeads} tenantConfig={tenantConfig} />
                  </div>
                </li>
              ))}
              {(!leadsByStatus[status] || leadsByStatus[status].length === 0) && (
                <li><div className="px-6 py-8 text-center text-sm text-muted-foreground">No {config.label.toLowerCase()} leads.</div></li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}