'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { LeadActions } from '@/components/leads/lead-actions';
import { SearchLeads } from '@/components/leads/search-leads';
import type { LeadWithDetails } from './page';
import { User } from 'next-auth';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  PhoneXMarkIcon,
  XCircleIcon,
  CheckCircleIcon,
  PlusIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-yellow-500/20',
    icon: ClockIcon
  },
  NO_ANSWER: {
    label: 'No Answer',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20',
    icon: PhoneXMarkIcon
  },
  REJECTED: {
    label: 'Rejected',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20',
    icon: XCircleIcon
  },
  CONFIRMED: {
    label: 'Converted',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    icon: CheckCircleIcon
  },
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">Manage and track your potential customers</p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <>
              <Link
                href="/leads/import"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-muted border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                Import CSV
              </Link>
              <Link
                href="/leads/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
              >
                <PlusIcon className="h-4 w-4" />
                Add Lead
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-card p-2 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex p-1 bg-muted/50 rounded-xl">
          {['daily', 'weekly', 'monthly'].map((filter) => (
            <Link
              key={filter}
              href={`/leads?timeFilter=${filter}${searchQuery ? `&query=${searchQuery}` : ''}`}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${timeFilter === filter
                ? 'bg-white dark:bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Link>
          ))}
        </div>
        <SearchLeads />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-2">
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col h-full bg-white dark:bg-card rounded-3xl border border-border/50 shadow-sm overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${config.color} ring-1 inset-0`}>
                  <config.icon className="h-5 w-5" />
                </div>
                <h2 className="font-semibold text-foreground">
                  {config.label}
                </h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                {leadsByStatus[status]?.length || 0}
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto max-h-[600px] custom-scrollbar">
              <ul className="space-y-3">
                {(leadsByStatus[status] || []).map((lead, index) => (
                  <motion.li
                    key={lead.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group p-4 rounded-2xl bg-muted/30 hover:bg-muted/60 border border-transparent hover:border-border/50 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/leads/${lead.id}`} className="text-sm font-semibold text-foreground hover:text-primary break-words">
                            {(lead.csvData as any).name || 'Unnamed Lead'}
                          </Link>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(lead.createdAt), 'MMM d')}</span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                            {lead.product.name}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>
                            {(lead.csvData as any).phone}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5 break-words">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"></span>
                            {(lead.csvData as any).address}
                            {((lead.csvData as any).city) && `, ${(lead.csvData as any).city}`}
                          </p>
                        </div>

                        {lead.assignedTo && (
                          <div className="mt-3 flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
                              {lead.assignedTo.name?.[0] || 'U'}
                            </div>
                            <span className="text-xs text-muted-foreground">Assigned to {lead.assignedTo.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {lead.status === 'CONFIRMED' && lead.order && (
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-green-500/10 text-green-600 text-[10px] font-medium ring-1 ring-green-500/20">
                            Order #{lead.order.number || lead.order.id.slice(0, 8)}
                          </span>
                        )}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <LeadActions lead={lead} user={user} onAction={refreshLeads} tenantConfig={tenantConfig} />
                        </div>
                      </div>
                    </div>
                  </motion.li>
                ))}
                {(!leadsByStatus[status] || leadsByStatus[status].length === 0) && (
                  <li className="flex flex-col items-center justify-center py-12 text-center">
                    <div className={`p-3 rounded-full bg-muted/50 mb-3 ${config.color.split(' ')[1]}`}>
                      <config.icon className="h-6 w-6 opacity-50" />
                    </div>
                    <p className="text-sm text-muted-foreground">No {config.label.toLowerCase()} leads found</p>
                  </li>
                )}
              </ul>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}