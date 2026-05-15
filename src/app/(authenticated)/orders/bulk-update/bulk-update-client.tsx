'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { playSuccessSound, playErrorSound } from '@/lib/sounds';
import {
  ArrowUpTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  TruckIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'RESCHEDULED';

interface PreviewItem {
  rowIndex: number;
  waybill: string;
  rawStatus: string;
  normalizedStatus: OrderStatus | null;
  statusChangeDate: string | null;
  customerName?: string;
  customerPhone?: string;
  cod?: string | number;
  match:
    | {
        kind: 'matched';
        orderId: string;
        orderNumber: number;
        currentStatus: OrderStatus;
        ourCustomerName: string;
        action: 'update' | 'noop' | 'invalid_transition';
        actionReason?: string;
      }
    | { kind: 'not_found' }
    | { kind: 'no_status' };
}

interface PreviewResponse {
  items: PreviewItem[];
  detected: {
    waybillColumn: string | null;
    statusColumn: string | null;
    dateColumn: string | null;
    nameColumn: string | null;
    phoneColumn: string | null;
    codColumn: string | null;
  };
  warnings: string[];
  totalRows: number;
  summary: {
    matched: number;
    notFound: number;
    noStatus: number;
    willUpdate: number;
    noop: number;
    invalid: number;
  };
}

interface ApplyResponse {
  success: boolean;
  processed: number;
  successCount: number;
  failureCount: number;
  summary: { delivered: number; returned: number; cancelled: number };
  results: Array<{
    orderId: string;
    success: boolean;
    previousStatus?: OrderStatus;
    newStatus?: OrderStatus;
    error?: string;
  }>;
}

const STATUS_BADGE: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  SHIPPED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  RETURNED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
  CANCELLED: 'bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  RESCHEDULED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
};

function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {status}
    </span>
  );
}

export function BulkUpdateClient() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null);
  // Row-level toggles — keyed by `${rowIndex}:${orderId}` so the user can
  // exclude individual rows before applying.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selected: File) => {
    setFile(selected);
    setPreview(null);
    setApplyResult(null);
    setExcluded(new Set());
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('file', selected);
      const res = await fetch('/api/orders/bulk-update/preview', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse file');
      }
      setPreview(data);
      if (data.summary.willUpdate === 0 && data.summary.matched === 0) {
        playErrorSound();
        toast.error('No matching orders found in this file');
      } else if (data.summary.willUpdate === 0) {
        toast.message('File parsed — no changes needed');
      } else {
        toast.success(`File parsed. ${data.summary.willUpdate} order(s) ready to update.`);
      }
    } catch (err) {
      playErrorSound();
      toast.error(err instanceof Error ? err.message : 'Failed to parse file');
      setFile(null);
    } finally {
      setPreviewing(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  // Rows the user has chosen to include — i.e. action === 'update' and not toggled off.
  const updatableItems = useMemo(() => {
    if (!preview) return [];
    return preview.items.filter(
      (it) => it.match.kind === 'matched' && it.match.action === 'update'
    );
  }, [preview]);

  const selectedToApply = useMemo(() => {
    return updatableItems.filter((it) => {
      if (it.match.kind !== 'matched') return false;
      const key = `${it.rowIndex}:${it.match.orderId}`;
      return !excluded.has(key);
    });
  }, [updatableItems, excluded]);

  const toggleExcluded = (rowIndex: number, orderId: string) => {
    const key = `${rowIndex}:${orderId}`;
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = async () => {
    if (selectedToApply.length === 0) {
      playErrorSound();
      toast.error('Nothing to apply');
      return;
    }
    if (!confirm(`Apply status updates to ${selectedToApply.length} order(s)? This cannot be undone.`)) {
      return;
    }
    setApplying(true);
    try {
      const payload = {
        updates: selectedToApply
          .filter((it) => it.match.kind === 'matched' && it.normalizedStatus)
          .map((it) => {
            const m = it.match as Extract<PreviewItem['match'], { kind: 'matched' }>;
            return {
              orderId: m.orderId,
              newStatus: it.normalizedStatus!,
              statusChangeDate: it.statusChangeDate,
              sourceWaybill: it.waybill,
            };
          }),
      };
      const res = await fetch('/api/orders/bulk-update/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: ApplyResponse | { error: string } = await res.json();
      if (!res.ok || 'error' in data) {
        throw new Error('error' in data ? data.error : 'Failed to apply updates');
      }
      setApplyResult(data);
      if (data.failureCount === 0) {
        playSuccessSound();
        toast.success(`Updated ${data.successCount} order(s) successfully`);
      } else {
        playErrorSound();
        toast.error(`${data.successCount} updated, ${data.failureCount} failed`);
      }
    } catch (err) {
      playErrorSound();
      toast.error(err instanceof Error ? err.message : 'Failed to apply updates');
    } finally {
      setApplying(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setPreview(null);
    setApplyResult(null);
    setExcluded(new Set());
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TruckIcon className="h-7 w-7 text-primary" /> Bulk Update from Courier File
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload the delivery / return export from your courier (Trans Express, Royal Express, or
            Farda Express). Orders will be matched by waybill / tracking number and updated in bulk.
          </p>
        </div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-muted border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Orders
        </Link>
      </div>

      {/* Drop zone */}
      {!preview && (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`block cursor-pointer rounded-2xl border-2 border-dashed transition-all p-12 text-center ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border bg-white dark:bg-card hover:border-primary/50 hover:bg-accent/30'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
            }}
          />
          <div className="flex flex-col items-center gap-3">
            {previewing ? (
              <ArrowPathIcon className="h-12 w-12 text-primary animate-spin" />
            ) : (
              <ArrowUpTrayIcon className="h-12 w-12 text-muted-foreground" />
            )}
            <div>
              <p className="text-lg font-semibold text-foreground">
                {previewing
                  ? 'Parsing your file...'
                  : isDragging
                  ? 'Drop file here'
                  : 'Drop your courier export here or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports .xlsx, .xls, and .csv files (max 10 MB).
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Trans Express: export "Current My Orders" from the portal. Columns are auto-detected.
              </p>
            </div>
          </div>
        </label>
      )}

      {/* Preview */}
      {preview && !applyResult && (
        <div className="space-y-4">
          {/* Detected columns + warnings */}
          <div className="p-4 rounded-xl bg-white dark:bg-card border border-border/50 shadow-sm space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="font-semibold text-foreground">File:</span>{' '}
                <span className="text-muted-foreground">{file?.name}</span>
                <span className="text-muted-foreground ml-3">
                  ({preview.totalRows} row{preview.totalRows === 1 ? '' : 's'})
                </span>
              </div>
              <button
                onClick={resetAll}
                className="text-xs px-3 py-1 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Upload different file
              </button>
            </div>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>
                Waybill column:{' '}
                <span className="font-mono text-foreground">
                  {preview.detected.waybillColumn ?? '— not found —'}
                </span>
              </span>
              <span>
                Status column:{' '}
                <span className="font-mono text-foreground">
                  {preview.detected.statusColumn ?? '— not found —'}
                </span>
              </span>
              {preview.detected.dateColumn && (
                <span>
                  Date column:{' '}
                  <span className="font-mono text-foreground">{preview.detected.dateColumn}</span>
                </span>
              )}
            </div>
            {preview.warnings.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <ul className="space-y-0.5">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard
              label="Will update"
              value={preview.summary.willUpdate}
              tint="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-200"
            />
            <SummaryCard
              label="Already up to date"
              value={preview.summary.noop}
              tint="bg-slate-50 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800/60 text-slate-700 dark:text-slate-200"
            />
            <SummaryCard
              label="Not found in DB"
              value={preview.summary.notFound}
              tint="bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/60 text-rose-700 dark:text-rose-200"
            />
            <SummaryCard
              label="Unmappable status"
              value={preview.summary.noStatus}
              tint="bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60 text-amber-700 dark:text-amber-200"
            />
            <SummaryCard
              label="Invalid transition"
              value={preview.summary.invalid}
              tint="bg-orange-50 dark:bg-orange-950/40 border-orange-200/60 dark:border-orange-800/60 text-orange-700 dark:text-orange-200"
            />
          </div>

          {/* Apply bar */}
          <div className="sticky top-0 z-10 p-4 rounded-xl bg-white/95 dark:bg-card/95 backdrop-blur border border-border/50 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold text-foreground">
                {selectedToApply.length}
              </span>{' '}
              <span className="text-muted-foreground">
                of {updatableItems.length} update{updatableItems.length === 1 ? '' : 's'} selected
              </span>
            </div>
            <button
              onClick={handleApply}
              disabled={applying || selectedToApply.length === 0}
              className="inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
            >
              {applying ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="h-4 w-4" />
              )}
              Apply {selectedToApply.length} Update{selectedToApply.length === 1 ? '' : 's'}
            </button>
          </div>

          {/* Items table */}
          <div className="bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                      Include
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                      Row
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                      Waybill
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                      Order #
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                      Customer
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                      File status
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                      Current → New
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {preview.items.map((it) => {
                    const matched = it.match.kind === 'matched';
                    const key =
                      matched && it.match.kind === 'matched'
                        ? `${it.rowIndex}:${it.match.orderId}`
                        : '';
                    const isExcluded = key ? excluded.has(key) : false;

                    let actionCell: React.ReactNode;
                    let rowTint = '';
                    if (it.match.kind === 'matched') {
                      if (it.match.action === 'update') {
                        actionCell = (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                            <CheckCircleIcon className="h-4 w-4" /> Will update
                          </span>
                        );
                      } else if (it.match.action === 'noop') {
                        actionCell = (
                          <span className="text-muted-foreground text-xs">
                            {it.match.actionReason || 'No change'}
                          </span>
                        );
                        rowTint = 'opacity-60';
                      } else {
                        actionCell = (
                          <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-300 text-xs">
                            <ExclamationTriangleIcon className="h-4 w-4" />{' '}
                            {it.match.actionReason || 'Invalid transition'}
                          </span>
                        );
                        rowTint = 'opacity-60';
                      }
                    } else if (it.match.kind === 'not_found') {
                      actionCell = (
                        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 text-xs">
                          <XCircleIcon className="h-4 w-4" /> Order not found
                        </span>
                      );
                      rowTint = 'opacity-60';
                    } else {
                      actionCell = (
                        <span className="text-muted-foreground text-xs">
                          Status "{it.rawStatus}" not mapped
                        </span>
                      );
                      rowTint = 'opacity-60';
                    }

                    return (
                      <tr key={it.rowIndex} className={`hover:bg-muted/20 ${rowTint}`}>
                        <td className="px-3 py-2.5">
                          {it.match.kind === 'matched' && it.match.action === 'update' ? (
                            <input
                              type="checkbox"
                              checked={!isExcluded}
                              onChange={() =>
                                toggleExcluded(it.rowIndex, (it.match as any).orderId)
                              }
                              className="h-4 w-4 rounded border-border accent-primary"
                            />
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground text-xs">
                          {it.rowIndex}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-foreground">
                          {it.waybill}
                        </td>
                        <td className="px-3 py-2.5">
                          {it.match.kind === 'matched' ? (
                            <Link
                              href={`/orders/${it.match.orderId}`}
                              target="_blank"
                              className="text-primary hover:underline font-medium"
                            >
                              #{it.match.orderNumber}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {it.match.kind === 'matched'
                            ? it.match.ourCustomerName
                            : it.customerName ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-xs text-foreground">{it.rawStatus || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          {it.match.kind === 'matched' && it.normalizedStatus ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <StatusPill status={it.match.currentStatus} />
                              <span className="text-muted-foreground">→</span>
                              <StatusPill status={it.normalizedStatus} />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">{actionCell}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className="space-y-4">
          <div
            className={`p-6 rounded-xl border ${
              applyResult.failureCount === 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60'
            }`}
          >
            <div className="flex items-start gap-3">
              {applyResult.failureCount === 0 ? (
                <CheckCircleIcon className="h-8 w-8 text-emerald-600 flex-shrink-0" />
              ) : (
                <ExclamationTriangleIcon className="h-8 w-8 text-amber-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">
                  {applyResult.failureCount === 0 ? 'All updates applied' : 'Updates applied with some failures'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Processed {applyResult.processed} record(s):{' '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {applyResult.successCount} succeeded
                  </span>
                  {applyResult.failureCount > 0 && (
                    <>
                      {', '}
                      <span className="font-semibold text-rose-700 dark:text-rose-300">
                        {applyResult.failureCount} failed
                      </span>
                    </>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {applyResult.summary.delivered > 0 && (
                    <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                      {applyResult.summary.delivered} delivered
                    </span>
                  )}
                  {applyResult.summary.returned > 0 && (
                    <span className="px-2 py-1 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                      {applyResult.summary.returned} returned (stock restored)
                    </span>
                  )}
                  {applyResult.summary.cancelled > 0 && (
                    <span className="px-2 py-1 rounded-md bg-slate-200 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                      {applyResult.summary.cancelled} cancelled
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Failures */}
          {applyResult.failureCount > 0 && (
            <div className="bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/30 text-sm font-medium text-foreground">
                Failed updates
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                        Order ID
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {applyResult.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <tr key={r.orderId}>
                          <td className="px-3 py-2 font-mono text-xs">{r.orderId.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-rose-700 dark:text-rose-300">
                            {r.error}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <DocumentArrowDownIcon className="h-4 w-4" /> Upload another file
            </button>
            <Link
              href="/orders"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white dark:bg-muted border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors shadow-sm"
            >
              <ArrowLeftIcon className="h-4 w-4" /> Back to Orders
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className={`p-3 rounded-xl border ${tint}`}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
    </div>
  );
}
