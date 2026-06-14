'use client';

import { useState, useEffect, useMemo } from 'react';
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

// Production-grade status palette: each status has a clearly distinct hue,
// a colored left-border stripe, a strong row tint, and a pill badge.
const STATUS_CONFIG = {
  // Colors matched to Genzo's lead-table legend:
  // Pending = lavender, Ok = green, No Answer = yellow, Rejected = salmon, Deleted = pale pink.
  PENDING: {
    label: 'Pending',
    rowBg: 'bg-[#e9eaf7]',
    leftBorder: 'border-l-[#9499d8]',
    badge: 'bg-[#e3e4f5] text-[#5b60a8] ring-1 ring-[#c9cdef]',
    numBadge: 'bg-[#8b90d4] text-white',
    dot: 'bg-[#b7bbe0]',
    chipActive: 'bg-[#8b90d4] text-white border-[#8b90d4] shadow-sm',
    chipIdle: 'bg-[#eceefa] text-[#5b60a8] border-[#c9cdef] hover:bg-[#dde0f4]',
    icon: ClockIcon,
  },
  NO_ANSWER: {
    label: 'No Answer',
    rowBg: 'bg-[#fbf7cf]',
    leftBorder: 'border-l-[#e0cf3a]',
    badge: 'bg-[#faf4c2] text-[#8a7a1a] ring-1 ring-[#ece0a0]',
    numBadge: 'bg-[#d9c83a] text-white',
    dot: 'bg-[#e6d84a]',
    chipActive: 'bg-[#d9c83a] text-white border-[#d9c83a] shadow-sm',
    chipIdle: 'bg-[#fbf7cf] text-[#8a7a1a] border-[#ece0a0] hover:bg-[#f7f1b8]',
    icon: PhoneXMarkIcon,
  },
  CONFIRMED: {
    label: 'Ok',
    rowBg: 'bg-[#e4f5e0]',
    leftBorder: 'border-l-[#5cb85c]',
    badge: 'bg-[#e3f3e3] text-[#3c8c3c] ring-1 ring-[#bce3bc]',
    numBadge: 'bg-[#5cb85c] text-white',
    dot: 'bg-[#86d486]',
    chipActive: 'bg-[#5cb85c] text-white border-[#5cb85c] shadow-sm',
    chipIdle: 'bg-[#e4f5e0] text-[#3c8c3c] border-[#bce3bc] hover:bg-[#d4efce]',
    icon: CheckCircleIcon,
  },
  REJECTED: {
    label: 'Rejected',
    rowBg: 'bg-[#fbe7e4]',
    leftBorder: 'border-l-[#d9655c]',
    badge: 'bg-[#fae6e5] text-[#c9453f] ring-1 ring-[#f0c2bd]',
    numBadge: 'bg-[#d9655c] text-white',
    dot: 'bg-[#e98a80]',
    chipActive: 'bg-[#d9655c] text-white border-[#d9655c] shadow-sm',
    chipIdle: 'bg-[#fbe7e4] text-[#c9453f] border-[#f0c2bd] hover:bg-[#f7d8d3]',
    icon: XCircleIcon,
  },
  DELETED: {
    label: 'Deleted',
    rowBg: 'bg-[#f3ece8]',
    leftBorder: 'border-l-[#c9b3a8]',
    badge: 'bg-[#f1e8e3] text-[#8a7268] ring-1 ring-[#ddccc3]',
    numBadge: 'bg-[#bfa99e] text-white',
    dot: 'bg-[#d8c2b8]',
    chipActive: 'bg-[#bfa99e] text-white border-[#bfa99e] shadow-sm',
    chipIdle: 'bg-[#f3ece8] text-[#8a7268] border-[#ddccc3] hover:bg-[#ebe0d9]',
    icon: TrashIcon,
  },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

// Format a Date as local YYYY-MM-DD (avoids UTC shift from toISOString())
function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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

  // Filter bar state — initialized from URL search params
  const [statusFilter, setStatusFilter] = useState((searchParams.status as string) || 'ANY');
  const [userFilter, setUserFilter] = useState((searchParams.userId as string) || 'ANY');
  const [startDate, setStartDate] = useState((searchParams.startDate as string) || '');
  const [endDate, setEndDate] = useState((searchParams.endDate as string) || '');
  // Which date field the date-range applies to: 'createdAt' (default) or 'statusChangedAt'
  const [dateField, setDateField] = useState<'createdAt' | 'statusChangedAt'>(
    (searchParams.dateField as string) === 'statusChangedAt' ? 'statusChangedAt' : 'createdAt'
  );
  const showAll = searchParams.all === '1';

  // Keep server-provided initialLeads in sync after navigation (filter changes)
  useEffect(() => { setLeads(initialLeads); setSelectedIds([]); }, [initialLeads]);

  // Sync local filter state when URL changes (browser back/forward, manual nav)
  useEffect(() => {
    setStatusFilter((searchParams.status as string) || 'ANY');
    setUserFilter((searchParams.userId as string) || 'ANY');
    setStartDate((searchParams.startDate as string) || '');
    setEndDate((searchParams.endDate as string) || '');
    setDateField((searchParams.dateField as string) === 'statusChangedAt' ? 'statusChangedAt' : 'createdAt');
  }, [searchParams.status, searchParams.userId, searchParams.startDate, searchParams.endDate, searchParams.all, searchParams.dateField]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // Build URL from current filters; overrides win over current state.
  // Pass `null` in overrides to explicitly clear a key.
  const buildUrl = (overrides: Record<string, string | number | null | undefined> = {}) => {
    const params = new URLSearchParams();
    const base: Record<string, string | number | null | undefined> = {
      status: statusFilter,
      userId: userFilter,
      startDate,
      endDate,
      // Only emit dateField when it's not the default — keeps URLs clean.
      dateField: dateField === 'statusChangedAt' ? 'statusChangedAt' : '',
      all: showAll ? '1' : '',
      page: currentPage,
      pageSize,
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
  const FILTER_STORAGE_KEY = 'jnex_leads_filters_v1';

  // Which search-param keys are considered "filters" for the purpose of
  // restoration. Pagination is intentionally NOT persisted — when you come
  // back to the list, you want page 1 of your filters, not page 47.
  const FILTER_KEYS = ['status', 'userId', 'startDate', 'endDate', 'all', 'dateField'] as const;

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

  const handleSearch = () => { navigate({}); };

  const handlePageChange = (newPage: number) => { router.push(buildUrl({ page: newPage })); };

  const handlePageSizeChange = (newSize: number) => { router.push(buildUrl({ pageSize: newSize, page: 1 })); };

  const refreshLeads = () => { router.refresh(); setSelectedIds([]); };

  // Status filter chip click — auto-applies
  const handleStatusChip = (key: string) => {
    setStatusFilter(key);
    navigate({ status: key });
  };

  // User filter dropdown — auto-applies
  const handleUserChange = (val: string) => {
    setUserFilter(val);
    navigate({ userId: val });
  };

  // Quick date range filters
  type QuickRange = 'today' | 'yesterday' | 'week' | 'month' | 'all';
  const applyQuickRange = (range: QuickRange) => {
    const today = new Date();
    if (range === 'all') {
      setStartDate(''); setEndDate('');
      navigate({ startDate: '', endDate: '', all: '1' });
      return;
    }
    let s: Date, e: Date;
    if (range === 'today') {
      s = new Date(today); e = new Date(today);
    } else if (range === 'yesterday') {
      s = new Date(today); s.setDate(s.getDate() - 1);
      e = new Date(s);
    } else if (range === 'week') {
      s = new Date(today); s.setDate(s.getDate() - 6);
      e = new Date(today);
    } else { // month
      s = new Date(today.getFullYear(), today.getMonth(), 1);
      e = new Date(today);
    }
    const sStr = toYMD(s);
    const eStr = toYMD(e);
    setStartDate(sStr); setEndDate(eStr);
    navigate({ startDate: sStr, endDate: eStr, all: '' });
  };

  // Detect which quick-range chip is currently active (for highlighting)
  const activeQuickRange: QuickRange | 'custom' | null = useMemo(() => {
    if (showAll) return 'all';
    if (!startDate && !endDate) return 'today'; // server defaults to today
    const todayStr = toYMD(new Date());
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestStr = toYMD(yest);
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
    const weekStartStr = toYMD(weekStart);
    const monthStart = toYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    if (startDate === todayStr && endDate === todayStr) return 'today';
    if (startDate === yestStr && endDate === yestStr) return 'yesterday';
    if (startDate === weekStartStr && endDate === todayStr) return 'week';
    if (startDate === monthStart && endDate === todayStr) return 'month';
    return 'custom';
  }, [startDate, endDate, showAll]);

  const resetFilters = () => {
    setStatusFilter('ANY');
    setUserFilter('ANY');
    setStartDate('');
    setEndDate('');
    setDateField('createdAt');
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
    statusFilter !== 'ANY' || userFilter !== 'ANY' || showAll || activeQuickRange === 'custom';

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
          <p className="text-sm text-muted-foreground mt-0.5">
            {(() => {
              const labels: Record<string, string> = {
                today: "Showing today's leads",
                yesterday: "Showing yesterday's leads",
                week: 'Showing leads from the last 7 days',
                month: 'Showing leads from this month',
                all: 'Showing all leads',
                custom: startDate && endDate ? `Showing leads from ${startDate} to ${endDate}` : 'Showing leads',
              };
              const base = labels[activeQuickRange ?? 'today'] || 'Showing leads';
              const extras: string[] = [];
              if (dateField === 'statusChangedAt') extras.push('by status change date');
              if (statusFilter !== 'ANY') extras.push(`status: ${STATUS_CONFIG[statusFilter as StatusKey]?.label ?? statusFilter}`);
              if (userFilter !== 'ANY') {
                const u = teamMembers.find((m) => m.id === userFilter);
                if (u) extras.push(`user: ${u.name || u.email}`);
              }
              return extras.length ? `${base} \u2022 ${extras.join(' \u2022 ')}` : base;
            })()}
          </p>
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

      {/* Filter Bar — Genzo horizontal dropdown layout */}
      <div className="p-4 bg-white rounded-md border border-[#e3e6ea] shadow-sm space-y-3">
        {/* Genzo primary row: Status · User · Start Date · End Date · Search */}
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Status</label>
            <select value={statusFilter} onChange={(e) => handleStatusChip(e.target.value as StatusKey | 'ANY')}
              className="h-9 px-3 rounded-md border border-[#d4d9e0] bg-white text-sm text-slate-600 focus:ring-2 focus:ring-[#e89c31]/20 focus:border-[#e89c31] focus:outline-none">
              <option value="ANY">Any</option>
              {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">User</label>
            <select value={userFilter} onChange={(e) => handleUserChange(e.target.value)}
              className="h-9 px-3 rounded-md border border-[#d4d9e0] bg-white text-sm text-slate-600 focus:ring-2 focus:ring-[#e89c31]/20 focus:border-[#e89c31] focus:outline-none">
              <option value="ANY">Any</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name || m.email}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="h-9 px-3 rounded-md border border-[#d4d9e0] bg-white text-sm text-slate-600 focus:ring-2 focus:ring-[#e89c31]/20 focus:border-[#e89c31] focus:outline-none" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500">End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="h-9 px-3 rounded-md border border-[#d4d9e0] bg-white text-sm text-slate-600 focus:ring-2 focus:ring-[#e89c31]/20 focus:border-[#e89c31] focus:outline-none" />
          </div>

          <button onClick={handleSearch}
            className="h-9 px-6 rounded-md bg-[#e89c31] text-white text-sm font-semibold hover:bg-[#d4860f] transition-colors">
            Search
          </button>

          {hasActiveCustomFilters && (
            <button onClick={resetFilters}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-md border border-[#d4d9e0] bg-white text-sm font-medium text-slate-500 hover:bg-gray-50 hover:text-slate-700 transition-colors"
              title="Reset all filters">
              <XMarkIcon className="h-4 w-4" /> Reset
            </button>
          )}
        </div>

        {/* Secondary row: quick period ranges + which date field they apply to (enhancements over Genzo) */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#eef0f3]">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-1 pt-2">
            <CalendarDaysIcon className="h-4 w-4" /> Quick:
          </div>
          {([
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'Last 7 days' },
            { key: 'month', label: 'This Month' },
            { key: 'all', label: 'All Time' },
          ] as { key: QuickRange; label: string }[]).map(({ key, label }) => {
            const isActive = activeQuickRange === key;
            return (
              <button key={key} type="button" onClick={() => applyQuickRange(key)}
                className={`mt-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? 'bg-[#e89c31] text-white border-[#e89c31] shadow-sm'
                    : 'bg-white text-slate-500 border-[#e0e4e9] hover:bg-gray-50 hover:text-slate-700'
                }`}>
                {label}
              </button>
            );
          })}
          <span className="mx-2 text-[#e0e4e9]">|</span>
          {([
            { key: 'createdAt' as const, label: 'By Lead Date' },
            { key: 'statusChangedAt' as const, label: 'By Status Change' },
          ]).map(({ key, label }) => {
            const isActive = dateField === key;
            return (
              <button key={key} type="button"
                onClick={() => { setDateField(key); navigate({ dateField: key === 'statusChangedAt' ? 'statusChangedAt' : '' }); }}
                className={`mt-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? 'bg-slate-600 text-white border-slate-600 shadow-sm'
                    : 'bg-white text-slate-500 border-[#e0e4e9] hover:bg-gray-50 hover:text-slate-700'
                }`}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status color legend (Genzo-style) */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {(Object.entries(STATUS_CONFIG) as [StatusKey, typeof STATUS_CONFIG[StatusKey]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-2 text-sm text-slate-600">
            <span className={`h-3.5 w-3.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
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
      <div className="bg-white rounded-md border border-[#e3e6ea] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#e6e9ed] bg-white">
                <th className="px-3 py-2 w-8">
                  <input type="checkbox" className="h-4 w-4 rounded border-border text-primary" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px]">#</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px]">Lead No</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px]">Lead Date</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px]">Status</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px]">Customer Name</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] hidden lg:table-cell">Address</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px]">Contact No</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] hidden xl:table-cell">Contact No 2</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] hidden md:table-cell">Product Code</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px] hidden xl:table-cell">Staff</th>
                <th className="text-left px-3 py-2 font-bold text-slate-600 text-[13px]">Add Order</th>
                <th className="text-right px-3 py-2 font-bold text-slate-600 text-[13px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {displayedLeads.length === 0 ? (
                <tr><td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">No leads found</td></tr>
              ) : (
                displayedLeads.map((lead, idx) => {
                  const config = STATUS_CONFIG[lead.status as StatusKey];
                  const csvData = lead.csvData as any;
                  const isSelected = selectedIds.includes(lead.id);
                  const rowIdx = ((currentPage - 1) * pageSize) + idx + 1;
                  const StatusIcon = config?.icon;

                  return (
                    <tr key={lead.id}
                      className={`${config?.rowBg ?? ''} border-l-4 ${config?.leftBorder ?? 'border-l-transparent'} ${isSelected ? 'ring-2 ring-inset ring-primary/30' : ''} hover:brightness-[0.98] dark:hover:brightness-110 transition-all`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" className="h-4 w-4 rounded border-border text-primary" checked={isSelected} onChange={() => toggleSelect(lead.id)} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{rowIdx}</td>
                      <td className="px-3 py-2">
                        <Link href={`/leads/${lead.id}`}>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${config?.numBadge ?? 'bg-gray-500 text-white'}`}>
                            {lead.number}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(lead.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2">
                        {config ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${config.badge}`}>
                            {StatusIcon && <StatusIcon className="h-3 w-3" />}
                            {config.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{lead.status}</span>
                        )}
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
