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
  PENDING: { label: 'Pending', border: 'border-yellow-500/50', text: 'text-yellow-300', icon: '🕒' },
  NO_ANSWER: { label: 'No Answer', border: 'border-orange-500/50', text: 'text-orange-300', icon: '📞' },
  REJECTED: { label: 'Rejected', border: 'border-red-500/50', text: 'text-red-300', icon: '❌' },
  CONFIRMED: { label: 'Converted', border: 'border-green-500/50', text: 'text-green-300', icon: '✅' },
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
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 bg-gray-900 text-white">
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-semibold text-white">Leads</h1>
            <p className="mt-2 text-sm text-gray-400">Manage your leads and track their status.</p>
             <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                <div className="flex space-x-2">
                    <Link href={`/leads?timeFilter=daily${searchQuery ? `&query=${searchQuery}` : ''}`} className={`px-3 py-1.5 rounded-md text-sm font-medium ${timeFilter === 'daily' ? 'bg-indigo-600 text-white' : 'text-gray-300 bg-gray-700/50 hover:bg-gray-700'}`}>Daily</Link>
                    <Link href={`/leads?timeFilter=weekly${searchQuery ? `&query=${searchQuery}` : ''}`} className={`px-3 py-1.5 rounded-md text-sm font-medium ${timeFilter === 'weekly' ? 'bg-indigo-600 text-white' : 'text-gray-300 bg-gray-700/50 hover:bg-gray-700'}`}>Weekly</Link>
                    <Link href={`/leads?timeFilter=monthly${searchQuery ? `&query=${searchQuery}` : ''}`} className={`px-3 py-1.5 rounded-md text-sm font-medium ${timeFilter === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-300 bg-gray-700/50 hover:bg-gray-700'}`}>Monthly</Link>
                </div>
                <div className="mt-4 sm:mt-0"><SearchLeads /></div>
            </div>
        </div>
        
        {/* --- PERMISSION-BASED BUTTONS --- */}
        {canCreate && (
            <div className="flex gap-4 flex-shrink-0">
                <Link href="/leads/import" className="inline-flex items-center px-4 py-2 border border-gray-600 rounded-md ring-1 ring-white/10 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700">Import CSV</Link>
                <Link href="/leads/new" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md ring-1 ring-white/10 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Add Lead</Link>
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <div key={status} className={`rounded-lg ring-1 ring-white/10 overflow-hidden bg-gray-800 border ${config.border}`}>
            <div className="px-6 py-4 border-b border-gray-700">
                <h2 className={`text-lg font-medium flex items-center space-x-2 ${config.text}`}>
                    <span>{config.icon}</span>
                    <span>{config.label} ({leadsByStatus[status]?.length || 0})</span>
                </h2>
            </div>
            <ul className="divide-y divide-gray-700">
              {(leadsByStatus[status] || []).map((lead) => (
                <li key={lead.id} className="p-4 hover:bg-gray-700/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-grow">
                        <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
                            {(lead.csvData as any).name || 'Unnamed Lead'}
                        </Link>
                        <p className="mt-1 text-sm text-gray-400">{lead.product.name}</p>
                        <p className="mt-1 text-sm text-gray-400">📞 {(lead.csvData as any).phone}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                      <p className="text-sm text-gray-400">{format(new Date(lead.createdAt), 'MMM d, p')}</p>
                      {lead.assignedTo && <p className="mt-1 text-xs text-gray-500">To: {lead.assignedTo.name}</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {lead.status === 'CONFIRMED' && lead.order ? 
                        (<p className="text-sm text-green-400">🛍️ Order #{lead.order.id}</p>) : 
                        (<div />) // Placeholder for alignment
                    }
                    {/* --- PASS PROPS TO ACTION COMPONENT --- */}
                    <LeadActions lead={lead} user={user} onAction={refreshLeads} tenantConfig={tenantConfig} />
                  </div>
                </li>
              ))}
              {(!leadsByStatus[status] || leadsByStatus[status].length === 0) && (
                <li><div className="px-6 py-8 text-center text-sm text-gray-500">No {config.label.toLowerCase()} leads.</div></li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}