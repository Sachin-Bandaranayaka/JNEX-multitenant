'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { LeadActions } from '@/components/leads/lead-actions';
import { DataExport } from '@/components/leads/data-export';
import { AssignLeadsDialog } from '@/components/leads/assign-leads-dialog';
import { FaIcon } from '@/components/leads/fa-icons';
import type { LeadWithDetails } from './page';
import { User } from 'next-auth';
import { toast } from 'sonner';
import { BellAlertIcon } from '@heroicons/react/24/outline';

// Status palette from docs/LEAD_PAGE_DESIGN_SPEC.md. `cls` tints the row and
// draws its 3px left stripe (see `.ll-page .st-*` in globals.css); `dot` is the
// legend color, which matches the stripe.
const STATUS_CONFIG = {
  PENDING: { label: 'Pending', cls: 'st-act', dot: '#adb5bd' },
  CONFIRMED: { label: 'Ok', cls: 'st-ok', dot: '#2fb344' },
  NO_ANSWER: { label: 'No Answer', cls: 'st-noans', dot: '#e6b800' },
  REJECTED: { label: 'Rejected', cls: 'st-reject', dot: '#e03131' },
  DELETED: { label: 'Deleted', cls: 'st-del', dot: '#f4a574' },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

function ContactIcons({ phone }: { phone: string | undefined }) {
  if (!phone) return <span className="ll-index">—</span>;
  const cleaned = phone.replace(/[^0-9+]/g, '');
  const waNumber = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span className="ll-phone">{phone}</span>
      <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" aria-label={`WhatsApp ${phone}`} className="ll-round ll-wa">
        <FaIcon name="whatsapp" />
      </a>
      <a href={`tel:${cleaned}`} title="Call" aria-label={`Call ${phone}`} className="ll-round ll-call">
        <FaIcon name="phone" />
      </a>
    </div>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="ll-label">{label}</dt>
      <dd className="mt-0.5 break-words">{value || '—'}</dd>
    </div>
  );
}

function NoteLink({ lead }: { lead: LeadWithDetails }) {
  return (
    <Link href={`/leads/${lead.id}`} title={lead.notes || 'No note'} aria-label={lead.notes ? `Note: ${lead.notes}` : `Open lead ${lead.number}`} className={`ll-icon-link${lead.notes ? ' has-note' : ''}`}>
      <FaIcon name="file" />
    </Link>
  );
}

export function LeadsClient({
  initialLeads, user, searchParams, tenantConfig, totalCount, currentPage, pageSize, filterStaff,
}: {
  initialLeads: LeadWithDetails[];
  filterStaff: { id: string; name: string | null }[];
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
}) {
  const router = useRouter();
  const canCreate = user.role === 'ADMIN' || user.permissions?.includes('CREATE_LEADS');
  const canEdit = user.role === 'ADMIN' || user.permissions?.includes('EDIT_LEADS');
  const canDelete = user.role === 'ADMIN' || user.permissions?.includes('DELETE_LEADS');
  const canCreateOrder = user.role === 'ADMIN' || user.permissions?.includes('CREATE_ORDERS');
  // Deciding who works a lead is the business owner's call, not a delegable
  // permission -- the endpoint enforces the same rule.
  const canAssign = user.role === 'ADMIN';
  const [assigningIds, setAssigningIds] = useState<string[] | null>(null);

  const handleLeadStatusChange = async (leadId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update status');
      }

      toast.success(`Lead marked as ${newStatus.replace('_', ' ').toLowerCase()}`);
      refreshLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred.');
    }
  };

  const [leads, setLeads] = useState<LeadWithDetails[]>(initialLeads);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState((searchParams.tableSearch as string) || '');

  // Filter bar state — initialized from URL search params
  const [statusFilter, setStatusFilter] = useState((searchParams.status as string) || 'ANY');
  const [startDate, setStartDate] = useState((searchParams.startDate as string) || '');
  const [endDate, setEndDate] = useState((searchParams.endDate as string) || '');
  const [staffFilter, setStaffFilter] = useState(typeof searchParams.staff === 'string' ? searchParams.staff : '');
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Close the bulk Action menu on any outside click.
  useEffect(() => {
    if (!actionMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!actionMenuRef.current?.contains(event.target as Node)) setActionMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [actionMenuOpen]);

  // Keep server-provided initialLeads in sync after navigation (filter changes)
  useEffect(() => { setLeads(initialLeads); setSelectedIds([]); }, [initialLeads]);

  // Sync local filter state when URL changes (browser back/forward, manual nav)
  useEffect(() => {
    setTableSearch((searchParams.tableSearch as string) || '');
    setStatusFilter((searchParams.status as string) || 'ANY');
    setStartDate((searchParams.startDate as string) || '');
    setEndDate((searchParams.endDate as string) || '');
    setStaffFilter(typeof searchParams.staff === 'string' ? searchParams.staff : '');
  }, [searchParams.tableSearch, searchParams.status, searchParams.startDate, searchParams.endDate, searchParams.staff]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Build URL from current filters; overrides win over current state.
  // Pass `null` in overrides to explicitly clear a key.
  const buildUrl = (overrides: Record<string, string | number | null | undefined> = {}) => {
    const params = new URLSearchParams();
    const base: Record<string, string | number | null | undefined> = {
      staff: staffFilter,
      query: typeof searchParams.query === 'string' ? searchParams.query : undefined,
      status: statusFilter,
      startDate,
      endDate,
      page: currentPage,
      pageSize,
      tableSearch,
    };
    const merged = { ...base, ...overrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v === null || v === undefined) return;
      const s = String(v);
      if (s && s !== 'ANY') params.set(k, s);
    });
    return `/leads?${params.toString()}`;
  };

  // localStorage key for filter persistence. Versioned so we can change
  // the shape later without poisoning users with stale data.
  const FILTER_STORAGE_KEY = 'jnex_leads_filters_v2';

  // Which search-param keys are considered "filters" for the purpose of
  // restoration. Pagination is intentionally NOT persisted — when you come
  // back to the list, you want page 1 of your filters, not page 47.
  const FILTER_KEYS = ['status', 'startDate', 'endDate'] as const;

  const persistFilters = (url: string) => {
    if (typeof window === 'undefined') return;
    try {
      const qs = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
      const params = new URLSearchParams(qs);
      const saved: Record<string, string> = {};
      for (const k of FILTER_KEYS) {
        const v = params.get(k);
        if (v) saved[k] = v;
      }
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  };

  const navigate = (overrides: Record<string, string | number | null | undefined>) => {
    const url = buildUrl({ page: 1, ...overrides });
    persistFilters(url);
    router.push(url);
  };

  // On mount only: if the URL has no filter params at all (i.e. user
  // clicked the "Leads" nav link or hit /leads directly), restore from
  // localStorage. URL wins — if any filter is in the URL, we leave it alone.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasFilterInUrl = FILTER_KEYS.some((k) => searchParams[k] != null && searchParams[k] !== '');
    if (hasFilterInUrl) return;

    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, string>;
      const keys = Object.keys(saved).filter((k) => saved[k]);
      if (keys.length === 0) return;

      const params = new URLSearchParams();
      for (const k of keys) params.set(k, saved[k]);
      // replace, not push — we don't want bare /leads sitting in history.
      router.replace(`/leads?${params.toString()}`);
    } catch {
      /* ignore parse errors */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Confirmation returns to the exact filtered/paginated list. Restore the
  // operator's vertical position as well so they can continue with the next call.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedScroll = window.sessionStorage.getItem('jnex_leads_return_scroll');
      if (!savedScroll) return;
      window.sessionStorage.removeItem('jnex_leads_return_scroll');
      const y = Number(savedScroll);
      if (Number.isFinite(y)) window.requestAnimationFrame(() => window.scrollTo({ top: y }));
    } catch {
      /* ignore unavailable session storage */
    }
  }, []);

  const handleSearch = () => { navigate({}); };

  const handlePageChange = (newPage: number) => { router.push(buildUrl({ page: newPage })); };

  const handlePageSizeChange = (newSize: number) => { router.push(buildUrl({ pageSize: newSize, page: 1 })); };

  const refreshLeads = () => { router.refresh(); setSelectedIds([]); };

  // Status filter chip click — auto-applies
  const handleStatusChip = (key: string) => {
    setStatusFilter(key);
    navigate({ status: key });
  };

  const resetFilters = () => {
    setStatusFilter('ANY');
    setStartDate('');
    setEndDate('');
    setStaffFilter('');
    // Wipe persisted filters so the user actually gets a clean slate next time.
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(FILTER_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    router.push('/leads');
  };

  const hasActiveCustomFilters =
    statusFilter !== 'ANY' || Boolean(startDate) || Boolean(endDate) || Boolean(staffFilter);

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
    <div className="space-y-4 py-2">
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

      {/* Filter card */}
      <section className="ll-card">
        <div className="ll-card-title">
          <h5 className="ll-title">Lead List</h5>
          {canCreate && (
            <div className="flex items-center gap-2">
              <Link href="/leads/import" className="ll-btn"><FaIcon name="upload" /> Import CSV</Link>
              <Link href="/leads/new" className="ll-btn ll-btn-solid"><FaIcon name="plus" /> Add Lead</Link>
            </div>
          )}
        </div>
        <div className="ll-card-body">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-2">
            <label className="flex items-center gap-3">
              <span className="ll-label">Status</span>
              <select value={statusFilter} onChange={(e) => handleStatusChip(e.target.value as StatusKey | 'ANY')} className="ll-input min-w-[150px]">
                <option value="ANY">Any</option>
                {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </label>
            {user.role !== 'TEAM_MEMBER' && (
              <label className="flex items-center gap-3">
                <span className="ll-label">User</span>
                <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="ll-input min-w-[150px]">
                  <option value="">Any</option>
                  {filterStaff.map((person) => <option key={person.id} value={person.id}>{person.name || 'Unnamed staff'}</option>)}
                </select>
              </label>
            )}
            <label className="flex items-center gap-3">
              <span className="ll-label leading-tight">Start<br />Date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="ll-input" />
            </label>
            <label className="flex items-center gap-3">
              <span className="ll-label">End Date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="ll-input" />
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleSearch} className="ll-btn-primary">Search</button>
              {hasActiveCustomFilters && (
                <button type="button" onClick={resetFilters} className="ll-btn" title="Reset all filters">
                  <FaIcon name="xmark" /> Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Table card */}
      <section className="ll-card">
        <div className="ll-card-title">
          <div className="ll-legend">
            {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([key, cfg], index) => (
              <span key={key} className="inline-flex items-center" style={{ marginLeft: index === 0 ? 0 : 10 }}>
                <span className="ll-dot" style={{ backgroundColor: cfg.dot }} />
                {cfg.label}
              </span>
            ))}
          </div>
        </div>

        <div className="ll-card-body" style={{ paddingBottom: 16 }}>
          {/* Search + export */}
          <div className="flex flex-wrap items-center justify-end gap-3 py-2">
            <label className="flex items-center gap-2">
              <span className="ll-toolbar-label">Search:</span>
              <span className="relative">
                <FaIcon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8a94a3]" />
                <input type="text" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="ll-search" aria-label="Search leads on this page" />
              </span>
            </label>
            <DataExport data={exportData} columns={exportColumns} filename="leads" buttonClassName="ll-btn" hideIcons />
          </div>

          {/* Entries + page size + bulk action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 pt-1">
            <div className="ll-toolbar-label">
              Showing {totalCount === 0 ? 0 : ((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} entries
            </div>
            <div className="flex items-center gap-2">
              <select onChange={(e) => handlePageSizeChange(Number(e.target.value))} value={pageSize} className="ll-pill-dark" aria-label="Rows per page">
                <option value={25}>Select 25</option>
                <option value={50}>Select 50</option>
                <option value={100}>Select 100</option>
              </select>
              <div className="relative" ref={actionMenuRef}>
                <button type="button" className="ll-pill" aria-haspopup="menu" aria-expanded={actionMenuOpen} disabled={isBulkLoading} onClick={() => setActionMenuOpen((open) => !open)}>
                  Action{someSelected ? ` (${selectedIds.length})` : ''} <FaIcon name="caretDown" className="text-[10px]" />
                </button>
                {actionMenuOpen && (
                  <div className="ll-menu" role="menu">
                    {!someSelected && <p className="px-2.5 pb-1.5 pt-1 text-[11.5px] text-[#8a94a3]">Tick leads in the Action column first.</p>}
                    {canAssign && <button type="button" role="menuitem" disabled={!someSelected} onClick={() => { setActionMenuOpen(false); setAssigningIds(selectedIds); }}>Reassign</button>}
                    <button type="button" role="menuitem" disabled={!someSelected} onClick={() => { setActionMenuOpen(false); handleBulkDelete(); }}>Delete</button>
                    <button type="button" role="menuitem" disabled={!someSelected} onClick={() => { setActionMenuOpen(false); toast.info('Reschedule feature coming soon'); }}>Reschedule</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full table on wide screens */}
          <div className="hidden overflow-x-auto xl:block">
            <table className="ll-table no-genzo-override">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>Lead No</th>
                  <th>Lead Date</th>
                  <th>Customer Name</th>
                  <th>Address</th>
                  <th>Contact No</th>
                  <th>Contact No 2</th>
                  <th>Other</th>
                  <th>Product Code</th>
                  <th>Staff</th>
                  <th>Add Order</th>
                  <th>
                    <label className="flex items-center gap-2">
                      Action
                      <input type="checkbox" className="ll-check" checked={allSelected} onChange={toggleSelectAll} aria-label="Select all leads on this page" />
                    </label>
                  </th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {displayedLeads.length === 0 ? (
                  <tr><td colSpan={13} className="py-12 text-center">No leads found</td></tr>
                ) : (
                  displayedLeads.map((lead, idx) => {
                    const config = STATUS_CONFIG[lead.status as StatusKey];
                    const csvData = lead.csvData as any;
                    const isSelected = selectedIds.includes(lead.id);
                    const rowIdx = ((currentPage - 1) * pageSize) + idx + 1;
                    const address = `${csvData.address || ''}${csvData.city ? `, ${csvData.city}` : ''}`;
                    return (
                      <tr key={lead.id} className={config?.cls ?? ''}>
                        <td className="ll-index text-center">{rowIdx}</td>
                        <td>
                          <Link href={`/leads/${lead.id}${displayedLeads[idx + 1] ? `?nextLeadId=${displayedLeads[idx + 1].id}` : ''}`} className="ll-lead-no">
                            {lead.number}
                          </Link>
                        </td>
                        <td className="ll-date">{format(new Date(lead.createdAt), 'yyyy-MM-dd HH:mm:ss')}</td>
                        <td className="ll-name min-w-[120px]">{csvData.name || 'Unnamed'}</td>
                        <td className="min-w-[160px]">{address || '—'}</td>
                        <td><ContactIcons phone={csvData.phone} /></td>
                        <td><ContactIcons phone={csvData.secondPhone} /></td>
                        <td className="min-w-[90px]">{csvData.notes || csvData.source || ''}</td>
                        <td title={lead.product.name}>{lead.product.code}</td>
                        <td className="min-w-[90px]">{lead.assignedTo?.name || '—'}</td>
                        <td>
                          <LeadActions lead={lead} user={user} onAction={refreshLeads} tenantConfig={tenantConfig} returnTo={buildUrl()} />
                        </td>
                        <td className="text-center">
                          <input type="checkbox" className="ll-check" checked={isSelected} onChange={() => toggleSelect(lead.id)} aria-label={`Select lead ${lead.number}`} />
                        </td>
                        <td className="text-center"><NoteLink lead={lead} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Below xl every column becomes a labeled field, so the whole lead
              stays visible without horizontal scrolling. */}
          <div className="space-y-2 xl:hidden">
            {displayedLeads.length === 0 ? (
              <div className="py-12 text-center">No leads found</div>
            ) : displayedLeads.map((lead, idx) => {
              const config = STATUS_CONFIG[lead.status as StatusKey];
              const csvData = lead.csvData as any;
              const isSelected = selectedIds.includes(lead.id);
              const rowIdx = ((currentPage - 1) * pageSize) + idx + 1;
              return (
                <article key={lead.id} className={`overflow-hidden rounded-lg p-3 ${config?.cls ?? ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <input type="checkbox" className="ll-check" checked={isSelected} onChange={() => toggleSelect(lead.id)} aria-label={`Select lead ${lead.number}`} />
                      <span className="ll-index">#{rowIdx}</span>
                      <Link href={`/leads/${lead.id}${displayedLeads[idx + 1] ? `?nextLeadId=${displayedLeads[idx + 1].id}` : ''}`} className="ll-lead-no">
                        {lead.number}
                      </Link>
                      <NoteLink lead={lead} />
                    </div>
                    <LeadActions lead={lead} user={user} onAction={refreshLeads} tenantConfig={tenantConfig} returnTo={buildUrl()} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    <CardField label="Lead Date" value={format(new Date(lead.createdAt), 'yyyy-MM-dd HH:mm:ss')} />
                    <div className="min-w-0"><dt className="ll-label">Customer Name</dt><dd className="ll-name mt-0.5 break-words">{csvData.name || 'Unnamed'}</dd></div>
                    <CardField label="Address" value={`${csvData.address || ''}${csvData.city ? `, ${csvData.city}` : ''}`} />
                    <div className="col-span-2 min-w-0 sm:col-span-1"><dt className="ll-label">Contact No</dt><dd className="mt-1"><ContactIcons phone={csvData.phone} /></dd></div>
                    <div className="col-span-2 min-w-0 sm:col-span-1"><dt className="ll-label">Contact No 2</dt><dd className="mt-1"><ContactIcons phone={csvData.secondPhone} /></dd></div>
                    <CardField label="Other" value={csvData.notes || csvData.source || ''} />
                    <CardField label="Product Code" value={lead.product.code} />
                    <CardField label="Staff" value={lead.assignedTo?.name || '—'} />
                  </dl>
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
              <p className="ll-toolbar-label">Page {currentPage} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} className="ll-page-btn" aria-label="Previous page">
                  <FaIcon name="chevronLeft" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <button key={pageNum} onClick={() => handlePageChange(pageNum)} className={`ll-page-btn${currentPage === pageNum ? ' is-current' : ''}`}>
                      {pageNum}
                    </button>
                  );
                })}
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="ll-page-btn" aria-label="Next page">
                  <FaIcon name="chevronRight" />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {assigningIds && (
        <AssignLeadsDialog
          leadIds={assigningIds}
          onClose={() => setAssigningIds(null)}
          onAssigned={refreshLeads}
        />
      )}
    </div>
  );
}
