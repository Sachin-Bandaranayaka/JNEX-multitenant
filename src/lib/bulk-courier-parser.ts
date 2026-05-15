// src/lib/bulk-courier-parser.ts
// Generic parser for courier delivery/return export files.
// Supports Excel (.xlsx, .xls) and CSV. Auto-detects column names so it
// works with Trans Express, Royal Express, and Farda Express exports
// without configuration. Verified against Trans Express "Current My Orders"
// export (columns: WAYBILL ID, STATUS, STATUS CHANGE DATE, ...).

import * as XLSX from 'xlsx';
import { OrderStatus } from '@prisma/client';

export interface ParsedCourierRow {
  rowIndex: number; // 1-based row number in the source sheet (incl. header)
  waybill: string;
  rawStatus: string;
  normalizedStatus: OrderStatus | null; // null when status string can't be mapped
  statusChangeDate: Date | null;
  customerName?: string;
  customerPhone?: string;
  cod?: string | number;
}

export interface DetectedColumns {
  waybillColumn: string | null;
  statusColumn: string | null;
  dateColumn: string | null;
  nameColumn: string | null;
  phoneColumn: string | null;
  codColumn: string | null;
}

export interface ParseResult {
  rows: ParsedCourierRow[];
  detected: DetectedColumns;
  warnings: string[];
  totalRows: number;
}

// Patterns are evaluated in order; first match wins.
const WAYBILL_PATTERNS: RegExp[] = [
  /waybill.*id/i,
  /waybill/i,
  /tracking.*number/i,
  /tracking.*no/i,
  /tracking/i,
  /^awb$/i,
  /awb.*number/i,
  /consignment/i,
];

const STATUS_PATTERNS: RegExp[] = [
  /current.*status/i,
  /^status$/i,
  /shipment.*status/i,
  /delivery.*status/i,
];

const DATE_PATTERNS: RegExp[] = [
  /status.*change.*date/i,
  /delivered.*at/i,
  /delivery.*date/i,
  /status.*date/i,
];

const NAME_PATTERNS: RegExp[] = [/customer.*name/i, /recipient.*name/i, /^name$/i];
const PHONE_PATTERNS: RegExp[] = [/phone.*number/i, /^phone$/i, /mobile/i, /contact/i];
const COD_PATTERNS: RegExp[] = [/^cod$/i, /^c\.?o\.?d/i];

function findColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const match = headers.find((h) => p.test(h));
    if (match) return match;
  }
  return null;
}

/**
 * Map a courier-provided status string to our internal OrderStatus enum.
 * Returns null when the status doesn't represent a meaningful change
 * (e.g. "Processing", "In Transit" — which we don't bulk-update).
 *
 * Only DELIVERED, RETURNED, and CANCELLED are eligible for bulk update —
 * those are terminal states that benefit from the upload workflow.
 */
export function normalizeCourierStatus(raw: string): OrderStatus | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();

  // Most specific first.
  if (/cancel/.test(s)) return OrderStatus.CANCELLED;
  if (/return/.test(s)) return OrderStatus.RETURNED;
  if (/deliver/.test(s)) return OrderStatus.DELIVERED;

  return null;
}

function parseDateLoose(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a courier file buffer (Excel or CSV) and return structured rows.
 * The parser is liberal about column naming — it auto-detects the
 * waybill, status, and date columns by matching common patterns.
 */
export function parseCourierFile(buffer: Buffer, filename: string): ParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  if (wb.SheetNames.length === 0) {
    return {
      rows: [],
      detected: {
        waybillColumn: null,
        statusColumn: null,
        dateColumn: null,
        nameColumn: null,
        phoneColumn: null,
        codColumn: null,
      },
      warnings: ['File contains no sheets'],
      totalRows: 0,
    };
  }

  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
    defval: null,
    raw: false,
  });

  if (rawRows.length === 0) {
    return {
      rows: [],
      detected: {
        waybillColumn: null,
        statusColumn: null,
        dateColumn: null,
        nameColumn: null,
        phoneColumn: null,
        codColumn: null,
      },
      warnings: ['File contains no data rows'],
      totalRows: 0,
    };
  }

  // Use the union of headers across the first few rows so a sparse first row
  // doesn't hide columns.
  const headerSet = new Set<string>();
  for (const r of rawRows.slice(0, 20)) {
    for (const k of Object.keys(r)) headerSet.add(k);
  }
  const headers = Array.from(headerSet);

  const detected: DetectedColumns = {
    waybillColumn: findColumn(headers, WAYBILL_PATTERNS),
    statusColumn: findColumn(headers, STATUS_PATTERNS),
    dateColumn: findColumn(headers, DATE_PATTERNS),
    nameColumn: findColumn(headers, NAME_PATTERNS),
    phoneColumn: findColumn(headers, PHONE_PATTERNS),
    codColumn: findColumn(headers, COD_PATTERNS),
  };

  const warnings: string[] = [];
  if (!detected.waybillColumn) warnings.push('Could not detect a waybill / tracking number column.');
  if (!detected.statusColumn) warnings.push('Could not detect a status column.');

  const rows: ParsedCourierRow[] = rawRows
    .map((r, idx) => {
      const waybill = detected.waybillColumn
        ? String(r[detected.waybillColumn] ?? '').trim()
        : '';
      const rawStatus = detected.statusColumn
        ? String(r[detected.statusColumn] ?? '').trim()
        : '';
      const statusChangeDate = detected.dateColumn ? parseDateLoose(r[detected.dateColumn]) : null;

      return {
        rowIndex: idx + 2, // +1 for 1-based, +1 for header row
        waybill,
        rawStatus,
        normalizedStatus: normalizeCourierStatus(rawStatus),
        statusChangeDate,
        customerName: detected.nameColumn
          ? String(r[detected.nameColumn] ?? '').trim() || undefined
          : undefined,
        customerPhone: detected.phoneColumn
          ? String(r[detected.phoneColumn] ?? '').trim() || undefined
          : undefined,
        cod: detected.codColumn ? r[detected.codColumn] ?? undefined : undefined,
      };
    })
    // Drop rows with no waybill — they're unactionable.
    .filter((r) => r.waybill.length > 0);

  return { rows, detected, warnings, totalRows: rawRows.length };
}
