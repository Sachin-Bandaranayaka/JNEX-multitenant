'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  BellAlertIcon,
  CalendarDaysIcon,
  ClockIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'sonner';

export interface EditableLeadReminder {
  id: string;
  remindAt: string | Date;
  note: string | null;
  status?: string;
}

interface LeadReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadLabel?: string;
  existingReminder?: EditableLeadReminder | null;
  onSaved?: (reminder: EditableLeadReminder) => void;
}

interface ReminderPreset {
  id: string;
  label: string;
  detail: string;
  date: Date | null;
}

const pad = (value: number) => String(value).padStart(2, '0');

function toDateTimeLocal(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function tomorrowAtNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function laterToday(reference = new Date()) {
  const date = new Date(reference);
  date.setHours(17, 0, 0, 0);

  if (date.getTime() <= reference.getTime()) {
    date.setTime(reference.getTime() + 2 * 60 * 60 * 1000);
    date.setMinutes(Math.ceil(date.getMinutes() / 15) * 15, 0, 0);
  }

  return date.getDate() === reference.getDate() ? date : null;
}

function inDays(days: number, hour = 9) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body?.error === 'string' ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function LeadReminderModal({
  isOpen,
  onClose,
  leadId,
  leadLabel,
  existingReminder,
  onSaved,
}: LeadReminderModalProps) {
  const [remindAt, setRemindAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const isSavingRef = useRef(false);

  isSavingRef.current = isSaving;

  const laterTodayDate = laterToday();
  const presets: ReminderPreset[] = [
    {
      id: 'later-today',
      label: 'Later today',
      detail: laterTodayDate
        ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(laterTodayDate)
        : 'Unavailable today',
      date: laterTodayDate,
    },
    { id: 'tomorrow', label: 'Tomorrow morning', detail: '9:00 AM', date: tomorrowAtNine() },
    { id: 'two-days', label: 'In 2 days', detail: '9:00 AM', date: inDays(2) },
    { id: 'next-week', label: 'Next week', detail: '9:00 AM', date: inDays(7) },
  ];

  useEffect(() => {
    if (!isOpen) return;

    const defaultDate = existingReminder?.remindAt ?? tomorrowAtNine();
    setRemindAt(toDateTimeLocal(defaultDate));
    setNote(existingReminder?.note ?? '');
    setSelectedPreset(existingReminder ? null : 'tomorrow');
    setError(null);
    setIsSaving(false);
  }, [existingReminder, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusFrame = window.requestAnimationFrame(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>('[data-dialog-autofocus]');
      target?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingRef.current) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedTime = remindAt ? new Date(remindAt) : null;
  const hasValidFutureTime = Boolean(
    selectedTime &&
    !Number.isNaN(selectedTime.getTime()) &&
    selectedTime.getTime() > Date.now(),
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!remindAt) {
      setError('Choose the date and time for this follow-up.');
      return;
    }

    const parsedDate = new Date(remindAt);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
      setError('The reminder time must be in the future.');
      return;
    }

    setIsSaving(true);
    try {
      const isRescheduling = Boolean(existingReminder?.id);
      const response = await fetch(
        isRescheduling
          ? `/api/lead-reminders/${existingReminder?.id}`
          : `/api/leads/${leadId}/reminders`,
        {
          method: isRescheduling ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            isRescheduling
              ? {
                  action: 'reschedule',
                  remindAt: parsedDate.toISOString(),
                  note: note.trim() || null,
                }
              : {
                  remindAt: parsedDate.toISOString(),
                  note: note.trim() || null,
                },
          ),
        },
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, 'Could not save this reminder.'));
      }

      const reminder = await response.json() as EditableLeadReminder;
      toast.success(isRescheduling ? 'Reminder rescheduled.' : 'Reminder scheduled.');
      onSaved?.(reminder);
      onClose();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save this reminder.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isSaving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-reminder-title"
        className="max-h-[92vh] w-full overflow-y-auto border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-lg sm:rounded-lg"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <BellAlertIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="lead-reminder-title" className="text-base font-bold text-slate-900 dark:text-white">
                {existingReminder ? 'Reschedule follow-up' : 'Schedule follow-up'}
              </h2>
              <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                {leadLabel ? `${leadLabel} · ` : ''}Choose when this lead should return to the queue.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close reminder dialog"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-5 py-5">
            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Quick times
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selectedPreset === preset.id}
                    disabled={!preset.date}
                    onClick={() => {
                      if (!preset.date) return;
                      setRemindAt(toDateTimeLocal(preset.date));
                      setSelectedPreset(preset.id);
                      setError(null);
                    }}
                    className={`relative flex min-h-14 items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45 ${
                      selectedPreset === preset.id
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 dark:border-blue-400 dark:bg-blue-950/60 dark:ring-blue-400'
                        : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-700 dark:hover:border-blue-500 dark:hover:bg-blue-950/40'
                    }`}
                  >
                    <ClockIcon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span>
                      <span className="block text-xs font-semibold text-slate-800 dark:text-slate-100">{preset.label}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">{preset.detail}</span>
                    </span>
                    {selectedPreset === preset.id && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="lead-remind-at" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <CalendarDaysIcon className="h-4 w-4" />
                Exact date &amp; time
              </label>
              <input
                id="lead-remind-at"
                type="datetime-local"
                value={remindAt}
                onChange={(event) => {
                  setRemindAt(event.target.value);
                  setSelectedPreset(null);
                  setError(null);
                }}
                min={toDateTimeLocal(new Date())}
                required
                data-dialog-autofocus
                className="block w-full rounded-md border-slate-300 bg-white text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
              {selectedTime && !Number.isNaN(selectedTime.getTime()) && (
                <p className="mt-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                  {new Intl.DateTimeFormat(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(selectedTime)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="lead-reminder-note" className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-200">
                Reminder note <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <textarea
                id="lead-reminder-note"
                rows={3}
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
                placeholder="What should the next caller know?"
                className="block w-full resize-none rounded-md border-slate-300 bg-white text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
              <p className="mt-1 text-right text-[10px] text-slate-500">{note.length}/500</p>
            </div>

            {error && (
              <div role="alert" className="border-l-4 border-red-500 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-950/50">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !hasValidFutureTime}
              className="inline-flex min-w-32 items-center justify-center gap-2 rounded-md bg-blue-600 px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-slate-900"
            >
              <BellAlertIcon className="h-4 w-4" />
              {isSaving ? 'Saving…' : existingReminder ? 'Save new time' : 'Set reminder'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
