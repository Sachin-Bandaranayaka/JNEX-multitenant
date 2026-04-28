'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { LeadActions } from '@/components/leads/lead-actions';
import { DataExport } from '@/components/leads/data-export';
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
  MagnifyingGlassIcon,
  ShoppingCartIcon,
  ChatBubbleLeftIcon,
  PhoneIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  XMarkIcon,
  DocumentTextIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-yellow-500/20',
    rowColor: 'bg-amber-100 dark:bg-amber-900/30',
    badgeColor: 'bg-blue-600 text-white',
    filterActive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 ring-1 ring-yellow-400/50',
    dotColor: 'bg-gray-400',
    icon: ClockIcon,
  },
  NO_ANSWER: {
    label: 'No Answer',
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-orange-500/20',
    rowColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    badgeColor: 'bg-blue-600 text-white',
    filterActive: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ring-1 ring-orange-400/50',
    dotColor: 'bg-yellow-400',
    icon: PhoneXMarkIcon,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20',
    rowColor: 'bg-red-50 dark:bg-red-900/20',
    badgeColor: 'bg-red-600 text-white',
    filterActive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 ring-1 ring-red-400/50',
    dotColor: 'bg-red-500',
    icon: XCircleIcon,
  },
  CONFIRMED: {
    label: 'Ok',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
    rowColor: 'bg-green-100 dark:bg-green-900/30',
    badgeColor: 'bg-green-600 text-white',
    filterActive: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 ring-1 ring-emerald-400/50',
    dotColor: 'bg-green-500',
    icon: CheckCircleIcon,
  },
  DELETED: {
    label: 'Deleted',
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 ring-pink-500/20',
    rowColor: 'bg-pink-50 dark:bg-pink-900/20',
    badgeColor: 'bg-pink-600 text-white',
    filterActive: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 ring-1 ring-pink-400/50',
    dotColor: 'bg-pink-400',
    icon: TrashIcon,
  },
};

function ContactIcons({ phone }: { phone: string | undefined }) {
  if (!phone) return <span className="text-muted-foreground">—</span>;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  const waNumber = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-foreground">{phone}</span>
      <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" title="WhatsApp"
        className="text-green-600 hover:text-green-700 transition-colors">
        <ChatBubbleLeftIcon className="h-4 w-4" />
      </a>
      <a href={`tel:${cleaned}`} title="Call" className="text-blue-600 hover:text-blue-700 transition-colors">
        <PhoneIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

export function LeadsClient({
  initialLeads, user, searchParams, tenantConfig, totalCount, currentPage, pageSize, teamMembers,
}: {
  initialLeads: LeadWithDetails[];
  user: User;
  searchParams: { [key: string]: string | string[] | undefined };
  tenantConfig?: {
    fardaExpressClientId?: string; fardaExpressApiKey?: string;
    transExpressApiKey?: string; transExpressOrderPrefix?: string;
    royalExpressApiKey?: string; royalExpressOrderPrefix?: string;
  };
  totalCount: number;
  currentPage: number;
  pageSize: number;
  teamMembers: { id: string; name: string | null; email: string }[];
}) {
  const router = useRouter();
  const canCreate = user.role === 'ADMIN' || user.permissions?.includes('CREATE_LEADS');
  const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_LEADS');
  const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_LEADS');

  const [leads, setLeads] = useState<LeadWithDetails[]>(initialLeads);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Filter bar state
  const [statusFilter, setStatusFilter] = useState((searchParams.status as string) || 'ANY');
  const [userFilter, setUserFilter] = useState((searchParams.userId as string) || 'ANY');
  const [startDate, setStartDate] = useState((searchParams.startDate as string) || '');
  const [endDate, setEndDate] = useState((searchParams.endDate as string) || '');

  const totalPages = Math.ceil(totalCount / pageSize);

  const buildUrl = (overrides: Record<string, string | number>) => {
    const params = new URLSearchParams();
    const vals: Record<string, string | number> = {
      status: statusFilter, userId: userFilter, startDate, endDate, page: currentPage, pageSize, ...overrides,
    };
    Object.entries(vals).forEach(([k, v]) => {
      if (v && v !== 'ANY' && v !== '') params.set(k, String(v));
    });
    return `/leads?${params.toString()}`;
  };

  const handleSearch = () => { router.push(buildUrl({ page: 1 })); };

  const handlePageChange = (newPage: number) => { router.push(buildUrl({ page: newPage })); };

  const handlePageSizeChange = (newSize: number) => { router.push(buildUrl({ pageSize: newSize, page: 1 })); };

  const refreshLeads = () => { router.refresh(); setSelectedIds([]); };

  // Client-side table search filter
  const displayedLeads = tableSearch
    ? leads.filter((lead) => {
        const csv = lead.csvData as any;
        const s = tableSearch.toLowerCase();
        return (csv.name || '').toLowerCase().includes(s) ||
          (csv.phone || '').toLowerCase().includes(s) ||
          (csv.address || '').toLowerCase().includes(s) ||
          lead.product.name.toLowerCase().includes(s) ||
          String(lead.number).includes(s);
      })
    : leads;

  // Bulk selection
  const allSelected = displayedLeads.length > 0 && displayedLeads.every((l) => selectedIds.includes(l.id));
  const someSelected = selectedIds.length > 0;

  const toggleSelectAll = () => {
    const ids = displayedLeads.map((l) => l.id);
    setSelectedIds(allSelected ? (prev) => prev.filter((id) => !ids.includes(id)) : (prev) => [...new Set([...prev, ...ids])]);
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    setIsBulkLoading(true);
    const results = await Promise.allSettled(
      selectedIds.map((id) =>
        fetch(`/api/leads/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
      )
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    setIsBulkLoading(false);
    toast.success(`${succeeded} lead(s) updated.`);
    refreshLeads();
  };

  const handleBulkDelete = async () => {
    setIsBulkLoading(true);
    const results = await Promise.allSettled(
      selectedIds.map((id) =>
        fetch(`/api/leads/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'DELETED' }) })
      )
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    setIsBulkLoading(false);
    toast.success(`${succeeded} lead(s) deleted.`);
    refreshLeads();
  };

  // Export data prep
  const exportColumns = [
    { key: 'number', label: '#' },
    { key: 'name', label: 'Customer Name' },
    { key: 'phone', label: 'Contact No' },
    { key: 'address', label: 'Address' },
    { key: 'product', label: 'Product Code' },
    { key: 'staff', label: 'Staff' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Lead Date' },
  ];
  const exportData = displayedLeads.map((l) => {
    const csv = l.csvData as any;
    return {
      number: l.number, name: csv.name || '', phone: csv.phone || '',
      address: `${csv.address || ''}${csv.city ? ', ' + csv.city : ''}`,
      product: l.product.code || l.product.name, staff: l.assignedTo?.name || '',
      status: STATUS_CONFIG[l.status as keyof typeof STATUS_CONFIG]?.label || l.status,
      date: format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm'),
    };
  });

  // Reminder alerts
  const now = new Date();
  const overdueReminders = leads.filter((l) => {
    if (!l.reminderDate) return false;
    const rd = new Date(l.reminderDate);
    return rd < now && rd.toDateString() !== now.toDateString() && (l.status === 'PENDING' || l.status === 'NO_ANSWER');
  });
  const todayReminders = leads.filter((l) => {
    if (!l.reminderDate) return false;
    return new Date(l.reminderDate).toDateString() === now.toDateString() && (l.status === 'PENDING' || l.status === 'NO_ANSWER');
  });

  return (
    <div className="space-y-4">
      {/* Reminder Alerts */}
      {overdueReminders.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500 text-white shadow-lg animate-pulse">
          <BellAlertIcon className="h-6 w-6 flex-shrink-0" />
          <div>
            <p className="font-bold text-base">🔴 {overdueReminders.length} Overdue Reminder{overdueReminders.length > 1 ? 's' : ''}!</p>
            <p className="text-sm text-red-100">You have leads with overdue follow-up reminders. Check the Remind Leads page.</p>
          </div>
          <Link href="/leads/remind-leads" className="ml-auto px-4 py-1.5 bg-white text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition-colors whitespace-nowrap">
            View All
          </Link>
        </div>
      )}
      {todayReminders.length > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-500 text-white shadow-lg">
          <BellAlertIcon className="h-6 w-6 flex-shrink-0" />
          <div>
            <p className="font-bold text-base">🔔 {todayReminders.length} Reminder{todayReminders.length > 1 ? 's' : ''} for Today!</p>
            <p className="text-sm text-orange-100">Follow up on these leads today.</p>
          </div>
          <Link href="/leads/remind-leads" className="ml-auto px-4 py-1.5 bg-white text-orange-600 rounded-lg text-sm font-bold hover:bg-orange-50 transition-colors whitespace-nowrap">
            View All
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lead List</h1>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <>
              <Link href="/leads/import" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-muted border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors shadow-sm">
                <ArrowUpTrayIcon className="h-4 w-4" /> Import CSV
              </Link>
              <Link href="/leads/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                <PlusIcon className="h-4 w-4" /> Add Lead
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar — Genzo style */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm">
        {/* Status dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none">
            <option value="ANY">Any</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        </div>

        {/* User dropdown */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">User</label>
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none">
            <option value="ANY">Any</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>{m.name || m.email}</option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Start Date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
        </div>

        {/* End Date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">End Date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
        </div>

        {/* Search button */}
        <button onClick={handleSearch}
          className="h-9 px-5 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm">
          Search
        </button>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${cfg.dotColor}`} />
            <span className="text-muted-foreground">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* Search + Export toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} entries
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)}
              className="h-8 pl-8 pr-3 w-48 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
          </div>
          <DataExport data={exportData} columns={exportColumns} filename="leads" />
        </div>
      </div>

      {/* Bulk actions + Select controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select onChange={(e) => handlePageSizeChange(Number(e.target.value))} value={pageSize}
            className="h-8 px-2 rounded-lg border border-border bg-primary text-primary-foreground text-xs font-medium focus:outline-none">
            <option value={25}>Select 25</option>
            <option value={50}>Select 50</option>
            <option value={100}>Select 100</option>
          </select>

          {someSelected && (
            <div className="relative inline-block">
              <select onChange={(e) => {
                const val = e.target.value;
                if (val === 'delete') handleBulkDelete();
                else if (val === 'reassign') toast.info('Reassign feature coming soon');
                else if (val === 'reschedule') toast.info('Reschedule feature coming soon');
                e.target.value = '';
              }} defaultValue="" disabled={isBulkLoading}
                className="h-8 px-3 rounded-lg border border-border bg-background text-sm font-medium text-foreground focus:outline-none disabled:opacity-50">
                <option value="" disabled>Action ({selectedIds.length})</option>
                <option value="reassign">Reassign</option>
                <option value="delete">Delete</option>
                <option value="reschedule">Reschedule</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" className="h-4 w-4 rounded border-border text-primary" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">#</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Lead No</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Lead Date</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Customer Name</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden lg:table-cell">Address</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Contact No</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden xl:table-cell">Contact No 2</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden md:table-cell">Product Code</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden xl:table-cell">Staff</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Add Order</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground text-xs">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {displayedLeads.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">No leads found</td></tr>
              ) : (
                displayedLeads.map((lead, idx) => {
                  const config = STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG];
                  const csvData = lead.csvData as any;
                  const isSelected = selectedIds.includes(lead.id);
                  const rowIdx = ((currentPage - 1) * pageSize) + idx + 1;

                  return (
                    <tr key={lead.id}
                      className={`${config?.rowColor ?? ''} ${isSelected ? 'ring-2 ring-inset ring-primary/30' : ''} hover:brightness-95 dark:hover:brightness-110 transition-all`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" className="h-4 w-4 rounded border-border text-primary" checked={isSelected} onChange={() => toggleSelect(lead.id)} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{rowIdx}</td>
                      <td className="px-3 py-2">
                        <Link href={`/leads/${lead.id}`}>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${config?.badgeColor ?? 'bg-gray-500 text-white'}`}>
                            {lead.number}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(lead.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{csvData.name || 'Unnamed'}</span>
                          {csvData.notes && (
                            <span className="relative group cursor-pointer" title={csvData.notes}>
                              <span className="relative flex h-5 w-5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-orange-500 text-white">
                                  <DocumentTextIcon className="h-3 w-3" />
                                </span>
                              </span>
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-52 p-2.5 text-xs bg-gray-900 text-white rounded-lg shadow-xl border border-gray-700">
                                <span className="font-semibold text-orange-300 block mb-0.5">📝 Note:</span>
                                {csvData.notes}
                              </span>
                            </span>
                          )}
                          {lead.reminderDate && (lead.status === 'PENDING' || lead.status === 'NO_ANSWER') && (
                            <span className="relative group" title={`Reminder: ${format(new Date(lead.reminderDate), 'MMM d, yyyy')}${lead.reminderNote ? ' - ' + lead.reminderNote : ''}`}>
                              <BellAlertIcon className={`h-4 w-4 cursor-pointer ${
                                new Date(lead.reminderDate) < now && new Date(lead.reminderDate).toDateString() !== now.toDateString()
                                  ? 'text-red-500 animate-bounce'
                                  : new Date(lead.reminderDate).toDateString() === now.toDateString()
                                  ? 'text-orange-500 animate-pulse'
                                  : 'text-blue-500'
                              }`} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
                        {csvData.address}{csvData.city ? `, ${csvData.city}` : ''}
                      </td>
                      <td className="px-3 py-2"><ContactIcons phone={csvData.phone} /></td>
                      <td className="px-3 py-2 hidden xl:table-cell"><ContactIcons phone={csvData.secondPhone} /></td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell text-xs">{lead.product.code}</td>
                      <td className="px-3 py-2 hidden xl:table-cell text-xs text-muted-foreground">{lead.assignedTo?.name || '—'}</td>
                      <td className="px-3 py-2">
                        {lead.status === 'CONFIRMED' && lead.order ? (
                          <Link href={`/orders/${lead.order.id}`} className="text-green-600 hover:text-green-700">
                            <ShoppingCartIcon className="h-4 w-4" />
                          </Link>
                        ) : (lead.status === 'PENDING' || lead.status === 'NO_ANSWER') && !lead.order ? (
                          <div className="flex items-center gap-1">
                            <ShoppingCartIcon className="h-4 w-4 text-blue-600 cursor-pointer" title="Add Order" />
                            <ArrowPathIcon className="h-4 w-4 text-blue-600 cursor-pointer" title="Return" />
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}
              className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <button key={pageNum} onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum ? 'bg-primary text-primary-foreground' : 'border border-border bg-background text-foreground hover:bg-muted'}`}>
                  {pageNum}
                </button>
              );
            })}
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}
              className="p-2 rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
