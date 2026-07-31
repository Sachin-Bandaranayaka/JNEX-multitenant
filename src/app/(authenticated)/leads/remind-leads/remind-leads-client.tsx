'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, isToday } from 'date-fns';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  BellAlertIcon,
  CheckIcon,
  ChatBubbleLeftIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import {
  EditableLeadReminder,
  LeadReminderModal,
} from '@/components/leads/lead-reminder-modal';

interface LeadCsvData {
  name?: string;
  phone?: string;
  secondPhone?: string;
  address?: string;
  city?: string;
}

export interface RemindLeadReminder {
  id: string;
  remindAt: string | Date;
  note: string | null;
  status: string;
  lead: {
    id: string;
    number: number;
    createdAt: string | Date;
    csvData: unknown;
    product: {
      name: string;
      code: string;
    };
    assignedTo: {
      name: string | null;
    } | null;
  };
}

type QueueFilter = 'due' | 'today' | 'upcoming' | 'all';

const QUEUE_TABS: Array<{ id: QueueFilter; label: string }> = [
  { id: 'due', label: 'Due now' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All active' },
];

function getCsvData(value: unknown): LeadCsvData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as LeadCsvData;
}

function cleanPhone(value?: string) {
  return value?.replace(/[^0-9+]/g, '') ?? '';
}

function whatsappPhone(value?: string) {
  const cleaned = cleanPhone(value);
  return cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
}

function isDue(reminder: RemindLeadReminder, now = new Date()) {
  return new Date(reminder.remindAt).getTime() <= now.getTime();
}

function isUpcoming(reminder: RemindLeadReminder, now = new Date()) {
  const remindAt = new Date(reminder.remindAt);
  return remindAt.getTime() > now.getTime() && !isToday(remindAt);
}

function getTiming(reminder: RemindLeadReminder, now = new Date()) {
  const remindAt = new Date(reminder.remindAt);

  if (remindAt.getTime() <= now.getTime()) {
    return {
      label: isToday(remindAt) ? 'Due now' : 'Overdue',
      edge: 'border-l-red-500',
      badge: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200',
    };
  }

  if (isToday(remindAt)) {
    return {
      label: 'Today',
      edge: 'border-l-amber-500',
      badge: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200',
    };
  }

  return {
    label: 'Upcoming',
    edge: 'border-l-blue-500',
    badge: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200',
  };
}

function laterToday() {
  const now = new Date();
  const date = new Date(now);
  date.setHours(17, 0, 0, 0);

  if (date.getTime() <= now.getTime()) {
    date.setTime(now.getTime() + 2 * 60 * 60 * 1000);
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  }

  return date.getDate() === now.getDate() ? date : null;
}

function tomorrowMorning() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function readError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body?.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function ContactValue({ phone }: { phone?: string }) {
  const cleaned = cleanPhone(phone);
  if (!phone || !cleaned) return <span className="text-slate-400">—</span>;

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <a
        href={`tel:${cleaned}`}
        className="shrink-0 text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-blue-400"
        aria-label={`Call ${phone}`}
      >
        <PhoneIcon className="h-3.5 w-3.5" />
      </a>
      <a
        href={`https://wa.me/${whatsappPhone(phone)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-emerald-700 hover:text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-emerald-400"
        aria-label={`Message ${phone} on WhatsApp`}
      >
        <ChatBubbleLeftIcon className="h-3.5 w-3.5" />
      </a>
      <span className="truncate text-[11px] text-slate-700 dark:text-slate-200" title={phone}>{phone}</span>
    </span>
  );
}

function CardField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 bg-white/70 p-2 dark:border-slate-700 dark:bg-slate-900/50">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 min-w-0 text-xs font-medium text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

interface RemindLeadsClientProps {
  reminders?: RemindLeadReminder[];
  /** Kept during the server-page migration from the former lead-shaped query. */
  leads?: RemindLeadReminder[];
}

export function RemindLeadsClient({ reminders, leads }: RemindLeadsClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<RemindLeadReminder[]>(reminders ?? leads ?? []);
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('due');
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingReminder, setEditingReminder] = useState<RemindLeadReminder | null>(null);
  const [snoozePreview, setSnoozePreview] = useState<{
    reminder: RemindLeadReminder;
    nextTime: Date;
  } | null>(null);
  const snoozeDialogRef = useRef<HTMLElement>(null);
  const pendingIdRef = useRef<string | null>(null);

  pendingIdRef.current = pendingId;

  useEffect(() => {
    if (!snoozePreview) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => {
      snoozeDialogRef.current?.querySelector<HTMLElement>('[data-snooze-autofocus]')?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pendingIdRef.current) {
        event.preventDefault();
        setSnoozePreview(null);
        return;
      }
      if (event.key !== 'Tab' || !snoozeDialogRef.current) return;

      const focusable = Array.from(snoozeDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [snoozePreview]);

  const now = new Date();
  const counts = {
    due: items.filter((item) => isDue(item, now)).length,
    today: items.filter((item) => {
      const remindAt = new Date(item.remindAt);
      return remindAt.getTime() > now.getTime() && isToday(remindAt);
    }).length,
    upcoming: items.filter((item) => isUpcoming(item, now)).length,
    all: items.length,
  };

  const displayedItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items
      .filter((item) => {
        if (activeFilter === 'due') return isDue(item);
        if (activeFilter === 'today') {
          const remindAt = new Date(item.remindAt);
          return remindAt.getTime() > Date.now() && isToday(remindAt);
        }
        if (activeFilter === 'upcoming') return isUpcoming(item);
        return true;
      })
      .filter((item) => {
        if (!query) return true;
        const csv = getCsvData(item.lead.csvData);
        return [
          item.lead.number,
          csv.name,
          csv.phone,
          csv.secondPhone,
          csv.address,
          csv.city,
          item.lead.product.name,
          item.lead.product.code,
          item.lead.assignedTo?.name,
          item.note,
        ].some((value) => String(value ?? '').toLowerCase().includes(query));
      })
      .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
  }, [activeFilter, items, search]);

  const completeReminder = async (reminder: RemindLeadReminder) => {
    setPendingId(reminder.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/lead-reminders/${reminder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not complete this reminder.'));

      setItems((current) => current.filter((item) => item.id !== reminder.id));
      toast.success(`Lead #${reminder.lead.number} follow-up completed.`);
      router.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not complete this reminder.');
    } finally {
      setPendingId(null);
    }
  };

  const prepareSnooze = (reminder: RemindLeadReminder, value: string) => {
    setActionError(null);
    if (value === 'custom') {
      setEditingReminder(reminder);
      return;
    }

    let nextTime: Date;
    if (value === '30m') nextTime = new Date(Date.now() + 30 * 60 * 1000);
    else if (value === 'today') {
      const sameDayTime = laterToday();
      if (!sameDayTime) {
        setActionError('“Later today” is no longer available. Choose tomorrow or a custom time.');
        return;
      }
      nextTime = sameDayTime;
    }
    else nextTime = tomorrowMorning();

    setSnoozePreview({ reminder, nextTime });
  };

  const snoozeReminder = async (reminder: RemindLeadReminder, nextTime: Date) => {
    setPendingId(reminder.id);
    setActionError(null);
    try {
      const response = await fetch(`/api/lead-reminders/${reminder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          remindAt: nextTime.toISOString(),
          note: reminder.note,
        }),
      });
      if (!response.ok) throw new Error(await readError(response, 'Could not snooze this reminder.'));

      const updated = await response.json() as EditableLeadReminder;
      setItems((current) => current.map((item) => (
        item.id === reminder.id
          ? {
              ...item,
              id: updated.id,
              remindAt: updated.remindAt,
              note: updated.note,
              status: updated.status ?? item.status,
            }
          : item
      )));
      toast.success(`Reminder snoozed until ${format(nextTime, 'MMM d, h:mm a')}.`);
      setSnoozePreview(null);
      router.refresh();
    } catch (error) {
      setSnoozePreview(null);
      setActionError(error instanceof Error ? error.message : 'Could not snooze this reminder.');
    } finally {
      setPendingId(null);
    }
  };

  const renderActions = (reminder: RemindLeadReminder, iconOnly = false) => {
    const csv = getCsvData(reminder.lead.csvData);
    const primaryPhone = cleanPhone(csv.phone);
    const isPending = pendingId === reminder.id;
    const sameDaySnooze = laterToday();
    const actionClass = `inline-flex h-7 items-center justify-center gap-1 rounded-sm border text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait disabled:opacity-50 ${iconOnly ? 'w-7 px-0' : 'px-2'}`;

    return (
      <div className={`flex flex-wrap items-center gap-1 ${iconOnly ? 'justify-start' : 'justify-end sm:justify-start'}`}>
        {primaryPhone && (
          <>
            <a
              href={`tel:${primaryPhone}`}
              title="Call customer"
              aria-label={`Call ${csv.phone}`}
              className={`${actionClass} border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
            >
              <PhoneIcon className="h-3.5 w-3.5" /> {!iconOnly && 'Call'}
            </a>
            <a
              href={`https://wa.me/${whatsappPhone(csv.phone)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp customer"
              aria-label={`Message ${csv.phone} on WhatsApp`}
              className={`${actionClass} border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300`}
            >
              <ChatBubbleLeftIcon className="h-3.5 w-3.5" /> {!iconOnly && 'WhatsApp'}
            </a>
          </>
        )}
        <Link
          href={`/leads/${reminder.lead.id}`}
          title="Open lead"
          aria-label={`Open lead ${reminder.lead.number}`}
          className={`${actionClass} border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
        >
          {iconOnly && <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />}
          {!iconOnly && 'Open lead'}
        </Link>
        <button
          type="button"
          onClick={() => completeReminder(reminder)}
          disabled={isPending}
          title="Mark reminder done"
          aria-label={`Complete reminder for lead ${reminder.lead.number}`}
          className={`${actionClass} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}
        >
          <CheckIcon className="h-3.5 w-3.5" /> {!iconOnly && (isPending ? 'Saving…' : 'Done')}
        </button>
        <label className="sr-only" htmlFor={`snooze-${reminder.id}`}>Snooze reminder</label>
        <select
          id={`snooze-${reminder.id}`}
          defaultValue=""
          disabled={isPending}
          onChange={(event) => {
            const value = event.target.value;
            event.target.value = '';
            if (value) prepareSnooze(reminder, value);
          }}
          title="Choose a snooze time"
          className={`h-7 rounded-sm border-slate-300 bg-white py-0 pl-2 pr-6 text-[11px] font-semibold text-slate-700 focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 ${iconOnly ? 'w-[76px]' : ''}`}
        >
          <option value="" disabled>Snooze…</option>
          <option value="30m">30 minutes</option>
          <option value="today" disabled={!sameDaySnooze}>
            {sameDaySnooze ? `Today · ${format(sameDaySnooze, 'h:mm a')}` : 'Today unavailable'}
          </option>
          <option value="tomorrow">Tomorrow · 9:00 AM</option>
          <option value="custom">Custom…</option>
        </select>
        <button
          type="button"
          onClick={() => setEditingReminder(reminder)}
          disabled={isPending}
          title="Reschedule reminder"
          aria-label={`Reschedule reminder for lead ${reminder.lead.number}`}
          className={`${actionClass} border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300`}
        >
          <ArrowPathIcon className="h-3.5 w-3.5" /> {!iconOnly && 'Reschedule'}
        </button>
      </div>
    );
  };

  const selectedTabLabel = QUEUE_TABS.find((tab) => tab.id === activeFilter)?.label ?? 'reminders';

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-700 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Remind Leads</h1>
            <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs font-bold ${
              counts.due > 0
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              <BellAlertIcon className="h-3.5 w-3.5" />
              {counts.due} due now
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Work scheduled callbacks, record the outcome, or move them to the right moment.
          </p>
        </div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{counts.all} active reminder{counts.all === 1 ? '' : 's'}</p>
      </header>

      <section aria-label="Reminder queue controls" className="border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full overflow-x-auto" role="tablist" aria-label="Reminder queue">
            {QUEUE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeFilter === tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`shrink-0 border-b-2 px-3 py-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
                  activeFilter === tab.id
                    ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 rounded-sm bg-slate-200 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {counts[tab.id]}
                </span>
              </button>
            ))}
          </div>

          <label className="relative block w-full shrink-0 lg:w-72">
            <span className="sr-only">Search reminders</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lead, customer or phone"
              className="h-9 w-full rounded-sm border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
          </label>
        </div>
      </section>

      {actionError && (
        <div role="alert" className="flex items-start justify-between gap-3 border-l-4 border-red-500 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-200">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="underline underline-offset-2">Dismiss</button>
        </div>
      )}

      <section aria-live="polite" className="overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="hidden xl:block">
          <table className="w-full table-fixed border-collapse text-left text-[11px] leading-[1.3] text-slate-800 dark:text-slate-100">
            <thead>
              <tr className="bg-[#f2f2f2] dark:bg-slate-800">
                <th className="w-[5%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Lead #</th>
                <th className="w-[7%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Lead Date</th>
                <th className="w-[9%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Customer</th>
                <th className="w-[10%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Address</th>
                <th className="w-[9%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Contact 1</th>
                <th className="w-[9%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Contact 2</th>
                <th className="w-[6%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Product</th>
                <th className="w-[12%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Reminder</th>
                <th className="w-[10%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Note</th>
                <th className="w-[7%] border-b border-r border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Staff</th>
                <th className="w-[16%] border-b border-slate-200 px-1.5 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-14 text-center">
                    <BellAlertIcon className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">No reminders in {selectedTabLabel.toLowerCase()}</p>
                    <p className="mt-1 text-xs text-slate-500">{search ? 'Try a different search.' : 'You are clear for this part of the queue.'}</p>
                  </td>
                </tr>
              ) : displayedItems.map((reminder, index) => {
                const csv = getCsvData(reminder.lead.csvData);
                const timing = getTiming(reminder);
                const address = [csv.address, csv.city].filter(Boolean).join(', ');
                return (
                  <tr
                    key={reminder.id}
                    className={`border-l-4 ${timing.edge} ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/35'} transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-950/20`}
                  >
                    <td className="border-b border-r border-slate-200 px-2 py-2 align-top dark:border-slate-700">
                      <Link href={`/leads/${reminder.lead.id}`} className="inline-flex rounded-sm bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white underline underline-offset-2 hover:bg-blue-700">
                        {reminder.lead.number}
                      </Link>
                    </td>
                    <td className="border-b border-r border-slate-200 px-2 py-2 align-top text-[10px] dark:border-slate-700">
                      <div>{format(new Date(reminder.lead.createdAt), 'yyyy-MM-dd')}</div>
                      <div>{format(new Date(reminder.lead.createdAt), 'HH:mm')}</div>
                    </td>
                    <td className="truncate border-b border-r border-slate-200 px-2 py-2 align-top font-semibold dark:border-slate-700" title={csv.name || 'Unnamed'}>{csv.name || 'Unnamed'}</td>
                    <td className="truncate border-b border-r border-slate-200 px-2 py-2 align-top dark:border-slate-700" title={address}>{address || '—'}</td>
                    <td className="border-b border-r border-slate-200 px-2 py-2 align-top dark:border-slate-700"><ContactValue phone={csv.phone} /></td>
                    <td className="border-b border-r border-slate-200 px-2 py-2 align-top dark:border-slate-700"><ContactValue phone={csv.secondPhone} /></td>
                    <td className="truncate border-b border-r border-slate-200 px-2 py-2 align-top font-semibold dark:border-slate-700" title={reminder.lead.product.name}>{reminder.lead.product.code || reminder.lead.product.name}</td>
                    <td className="border-b border-r border-slate-200 px-2 py-2 align-top dark:border-slate-700">
                      <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 font-bold tabular-nums ${timing.badge}`}>
                        <ClockIcon className="h-3.5 w-3.5" />
                        <span>
                          <span className="block text-[10px] uppercase tracking-wide">{timing.label}</span>
                          {format(new Date(reminder.remindAt), 'MMM d, h:mm a')}
                        </span>
                      </span>
                    </td>
                    <td className="border-b border-r border-slate-200 px-2 py-2 align-top dark:border-slate-700">
                      <p className="line-clamp-3 text-slate-600 dark:text-slate-300" title={reminder.note || ''}>{reminder.note || '—'}</p>
                    </td>
                    <td className="truncate border-b border-r border-slate-200 px-2 py-2 align-top dark:border-slate-700" title={reminder.lead.assignedTo?.name || ''}>{reminder.lead.assignedTo?.name || '—'}</td>
                    <td className="border-b border-slate-200 px-1.5 py-2 align-top dark:border-slate-700">{renderActions(reminder, true)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-700 xl:hidden">
          {displayedItems.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <BellAlertIcon className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">No reminders in {selectedTabLabel.toLowerCase()}</p>
              <p className="mt-1 text-xs text-slate-500">{search ? 'Try a different search.' : 'You are clear for this part of the queue.'}</p>
            </div>
          ) : displayedItems.map((reminder, index) => {
            const csv = getCsvData(reminder.lead.csvData);
            const timing = getTiming(reminder);
            const address = [csv.address, csv.city].filter(Boolean).join(', ');
            return (
              <article
                key={reminder.id}
                className={`border-l-4 p-3 ${timing.edge} ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/70 dark:bg-slate-800/35'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/leads/${reminder.lead.id}`} className="rounded-sm bg-blue-600 px-2 py-1 text-xs font-bold text-white underline underline-offset-2">Lead #{reminder.lead.number}</Link>
                    <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px] font-bold ${timing.badge}`}>
                      <ClockIcon className="h-3.5 w-3.5" />
                      {timing.label} · {format(new Date(reminder.remindAt), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500">
                    Created {format(new Date(reminder.lead.createdAt), 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                  <CardField label="Customer Name">{csv.name || 'Unnamed'}</CardField>
                  <CardField label="Address">{address || '—'}</CardField>
                  <CardField label="Contact No. 1"><ContactValue phone={csv.phone} /></CardField>
                  <CardField label="Contact No. 2"><ContactValue phone={csv.secondPhone} /></CardField>
                  <CardField label="Product">{reminder.lead.product.code || reminder.lead.product.name}</CardField>
                  <CardField label="Staff">{reminder.lead.assignedTo?.name || '—'}</CardField>
                  <div className="col-span-2 md:col-span-3 xl:col-span-2">
                    <CardField label="Reminder Note">{reminder.note || '—'}</CardField>
                  </div>
                </dl>

                <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                  {renderActions(reminder)}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {snoozePreview && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4">
          <section
            ref={snoozeDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="snooze-confirm-title"
            aria-describedby="snooze-confirm-description"
            className="w-full border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-sm sm:rounded-lg"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <ClockIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 id="snooze-confirm-title" className="text-sm font-bold text-slate-900 dark:text-white">
                  Snooze lead #{snoozePreview.reminder.lead.number}?
                </h2>
                <p id="snooze-confirm-description" className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  This reminder will return to the queue on{' '}
                  <strong className="text-slate-900 dark:text-white">
                    {format(snoozePreview.nextTime, 'EEEE, MMMM d')} at {format(snoozePreview.nextTime, 'h:mm a')}
                  </strong>.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSnoozePreview(null)}
                disabled={pendingId === snoozePreview.reminder.id}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Keep current time
              </button>
              <button
                type="button"
                data-snooze-autofocus
                onClick={() => void snoozeReminder(snoozePreview.reminder, snoozePreview.nextTime)}
                disabled={pendingId === snoozePreview.reminder.id}
                className="rounded-md bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-50 dark:focus:ring-offset-slate-900"
              >
                {pendingId === snoozePreview.reminder.id ? 'Snoozing…' : 'Confirm snooze'}
              </button>
            </div>
          </section>
        </div>
      )}

      {editingReminder && (
        <LeadReminderModal
          isOpen
          onClose={() => setEditingReminder(null)}
          leadId={editingReminder.lead.id}
          leadLabel={`Lead #${editingReminder.lead.number}`}
          existingReminder={editingReminder}
          onSaved={(saved) => {
            setItems((current) => current.map((item) => (
              item.id === editingReminder.id
                ? {
                    ...item,
                    id: saved.id,
                    remindAt: saved.remindAt,
                    note: saved.note,
                    status: saved.status ?? item.status,
                  }
                : item
            )));
            setEditingReminder(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
