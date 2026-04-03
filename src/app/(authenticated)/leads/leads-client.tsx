'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { LeadActions } from '@/components/leads/lead-actions';
import { SearchLeads } from '@/components/leads/search-leads';
import type { LeadWithDetails } from './page';
import { User } from 'next-auth';
import { toast } from 'sonner';
import {
  ClockIcon,
  PhoneXMarkIcon,
  XCircleIcon,
  CheckCircleIcon,
  PlusIcon,
  ArrowUpTrayIcon,
  TrashIcon,
  PhoneArrowDownLeftIcon,
} from '@heroicons/react/24/outline';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-yellow-500/20',
    rowColor: 'border-l-4 border-yellow-400 bg-yellow-50/40 dark:bg-yellow-900/10',
    filterActive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 ring-1 ring-yellow-400/50',
    icon: ClockIcon
  },
  NO_ANSWER: {
    label: 'No Answer',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20',
    rowColor: 'border-l-4 border-orange-400 bg-orange-50/40 dark:bg-orange-900/10',
    filterActive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ring-1 ring-orange-400/50',
    icon: PhoneXMarkIcon
  },
  REJECTED: {
    label: 'Rejected',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20',
    rowColor: 'border-l-4 border-red-400 bg-red-50/40 dark:bg-red-900/10',
    filterActive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-400/50',
    icon: XCircleIcon
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    rowColor: 'border-l-4 border-emerald-400 bg-emerald-50/40 dark:bg-emerald-900/10',
    filterActive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 ring-1 ring-emerald-400/50',
    icon: CheckCircleIcon
  },
};

function LeadAgeIndicator({ createdAt, status }: { createdAt: Date | string; status: string }) {
  const days = differenceInDays(new Date(), new Date(createdAt));
  const label = formatDistanceToNow(new Date(createdAt), { addSuffix: true });

  if (status !== 'PENDING') {
    return <span className="text-xs text-muted-foreground">{format(new Date(createdAt), 'MMM d, yyyy')}</span>;
  }

  const colorClass =
    days >= 7 ? 'text-red-600 dark:text-red-400 font-medium' :
    days >= 2 ? 'text-orange-500 dark:text-orange-400 font-medium' :
    'text-muted-foreground';

  return (
    <span className={`text-xs ${colorClass}`} title={format(new Date(createdAt), 'MMM d, yyyy HH:mm')}>
      {label}
    </span>
  );
}

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
    transExpressOrderPrefix?: string;
    royalExpressApiKey?: string;
    royalExpressOrderPrefix?: string;
  }
}) {
  const canCreate = user.role === 'ADMIN' || user.permissions?.includes('CREATE_LEADS');
  const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_LEADS');
  const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_LEADS');

  const [leads, setLeads] = useState<LeadWithDetails[]>(initialLeads);
  const [activeStatus, setActiveStatus] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const timeFilter = (searchParams.timeFilter as string) || 'daily';
  const searchQuery = (searchParams.query as string) || '';

  const refreshLeads = async () => {
    const response = await fetch('/api/leads');
    if (response.ok) {
      const data = await response.json();
      setLeads(data);
      setSelectedIds([]);
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

  const displayedLeads = activeStatus === 'ALL'
    ? filteredLeads
    : filteredLeads.filter(lead => lead.status === activeStatus);

  const countByStatus = filteredLeads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // --- Bulk selection ---
  const allDisplayedSelected = displayedLeads.length > 0 && displayedLeads.every(l => selectedIds.includes(l.id));
  const someSelected = selectedIds.length > 0;

  const toggleSelectAll = () => {
    const ids = displayedLeads.map(l => l.id);
    if (allDisplayedSelected) {
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...ids])]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    setIsBulkLoading(true);
    const results = await Promise.allSettled(
      selectedIds.map(id =>
        fetch(`/api/leads/${id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      )
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    setIsBulkLoading(false);

    if (failed === 0) {
      toast.success(`${succeeded} lead${succeeded !== 1 ? 's' : ''} marked as ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG]?.label ?? newStatus}.`);
    } else {
      toast.warning(`${succeeded} updated, ${failed} failed.`);
    }
    refreshLeads();
  };

  const handleBulkDelete = async () => {
    setIsBulkLoading(true);
    const results = await Promise.allSettled(
      selectedIds.map(id => fetch(`/api/leads/${id}`, { method: 'DELETE' }))
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    setIsBulkLoading(false);

    if (failed === 0) {
      toast.success(`${succeeded} lead${succeeded !== 1 ? 's' : ''} deleted.`);
    } else {
      toast.warning(`${succeeded} deleted, ${failed} failed (leads with orders cannot be deleted).`);
    }
    refreshLeads();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Time filter + Search bar */}
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

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveStatus('ALL')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeStatus === 'ALL'
            ? 'bg-foreground text-background'
            : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
        >
          All
          <span className="ml-1.5 text-xs opacity-70">{filteredLeads.length}</span>
        </button>
        {Object.entries(STATUS_CONFIG).map(([status, config]) => (
          <button
            key={status}
            onClick={() => setActiveStatus(status)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeStatus === status
              ? config.filterActive
              : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
          >
            <config.icon className="h-3.5 w-3.5" />
            {config.label}
            <span className="ml-0.5 text-xs opacity-70">{countByStatus[status] || 0}</span>
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.length} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {canEdit && (
              <>
                <button
                  onClick={() => handleBulkStatusChange('NO_ANSWER')}
                  disabled={isBulkLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:hover:bg-orange-500/20 transition-colors disabled:opacity-50"
                >
                  <PhoneArrowDownLeftIcon className="h-3.5 w-3.5" />
                  No Answer
                </button>
                <button
                  onClick={() => handleBulkStatusChange('REJECTED')}
                  disabled={isBulkLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  <XCircleIcon className="h-3.5 w-3.5" />
                  Reject
                </button>
              </>
            )}
            {canDelete && (
              <button
                onClick={handleBulkDelete}
                disabled={isBulkLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <button
              onClick={() => setSelectedIds([])}
              disabled={isBulkLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                    checked={allDisplayedSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Product</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Address</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Age</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {displayedLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No leads found
                  </td>
                </tr>
              ) : (
                displayedLeads.map((lead) => {
                  const config = STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG];
                  const csvData = lead.csvData as any;
                  const isSelected = selectedIds.includes(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className={`${config?.rowColor ?? ''} ${isSelected ? 'ring-2 ring-inset ring-primary/30' : ''} hover:brightness-95 dark:hover:brightness-110 transition-all`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                          checked={isSelected}
                          onChange={() => toggleSelect(lead.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <Link href={`/leads/${lead.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                            {csvData.name || 'Unnamed Lead'}
                          </Link>
                          {lead.status === 'CONFIRMED' && lead.order && (
                            <Link
                              href={`/orders/${lead.order.id}`}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-600 ring-1 ring-green-500/20 hover:bg-green-500/20 transition-colors w-fit"
                            >
                              Order #{lead.order.number || lead.order.id.slice(0, 8)} →
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{csvData.phone}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{lead.product.name}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
                        {csvData.address}{csvData.city ? `, ${csvData.city}` : ''}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        {lead.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary flex-shrink-0">
                              {lead.assignedTo.name?.[0] || 'U'}
                            </div>
                            <span className="text-xs text-muted-foreground truncate">{lead.assignedTo.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {config && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 w-fit ${config.color}`}>
                              <config.icon className="h-3 w-3" />
                              {config.label}
                            </span>
                          )}
                          {lead.status === 'NO_ANSWER' && lead.callAttempts > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/20 w-fit">
                              <PhoneXMarkIcon className="h-2.5 w-2.5" />
                              Called {lead.callAttempts}×
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <LeadAgeIndicator createdAt={lead.createdAt} status={lead.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <LeadActions lead={lead} user={user} onAction={refreshLeads} tenantConfig={tenantConfig} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
