// src/app/api/orders/bulk-update/preview/route.ts
// Accepts a courier export (Excel/CSV) and returns a preview of what would
// change. No DB writes happen here — the user must confirm via /apply.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getScopedPrismaClient } from '@/lib/prisma';
import { parseCourierFile, ParsedCourierRow } from '@/lib/bulk-courier-parser';
import { OrderStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cap upload size to avoid abuse. 10MB is plenty for 50k+ rows of Excel.
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface PreviewItem {
  rowIndex: number;
  waybill: string;
  rawStatus: string;
  normalizedStatus: OrderStatus | null;
  statusChangeDate: string | null;
  customerName?: string;
  customerPhone?: string;
  cod?: string | number;

  // Match against our DB
  match:
    | {
        kind: 'matched';
        orderId: string;
        orderNumber: number;
        currentStatus: OrderStatus;
        ourCustomerName: string;
        // The action we will take if applied. "noop" means no change.
        action: 'update' | 'noop' | 'invalid_transition';
        actionReason?: string;
      }
    | { kind: 'not_found' }
    | { kind: 'no_status' }; // file row had a status we don't bulk-update
}

// Courier file imports are deliberately delivery-only. Returns are verified
// manually by waybill on /returns/add-return.
const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.DELIVERED],
  [OrderStatus.CONFIRMED]: [OrderStatus.DELIVERED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.RESCHEDULED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.CANCELLED]: [],
};

function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false; // noop
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data with a "file" field' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsed;
    try {
      parsed = parseCourierFile(buffer, file.name);
    } catch (e) {
      return NextResponse.json(
        {
          error: 'Failed to parse file',
          details: e instanceof Error ? e.message : 'Unknown parser error',
        },
        { status: 400 }
      );
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json({
        items: [],
        detected: parsed.detected,
        warnings: [...parsed.warnings, 'No rows with a waybill / tracking number were found.'],
        totalRows: parsed.totalRows,
        summary: { matched: 0, notFound: 0, noStatus: 0, willUpdate: 0, noop: 0, invalid: 0 },
      });
    }

    // Look up all waybills in one query for performance.
    const prisma = getScopedPrismaClient(session.user.tenantId);
    const waybills = Array.from(new Set(parsed.rows.map((r: ParsedCourierRow) => r.waybill)));
    const orders = await prisma.order.findMany({
      where: { trackingNumber: { in: waybills } },
      select: {
        id: true,
        number: true,
        status: true,
        trackingNumber: true,
        customerName: true,
      },
    });

    const orderByWaybill = new Map<string, (typeof orders)[number]>();
    for (const o of orders) {
      if (o.trackingNumber) orderByWaybill.set(o.trackingNumber, o);
    }

    let matched = 0;
    let notFound = 0;
    let noStatus = 0;
    let willUpdate = 0;
    let noop = 0;
    let invalid = 0;

    const items: PreviewItem[] = parsed.rows.map((r) => {
      const base = {
        rowIndex: r.rowIndex,
        waybill: r.waybill,
        rawStatus: r.rawStatus,
        normalizedStatus: r.normalizedStatus,
        statusChangeDate: r.statusChangeDate ? r.statusChangeDate.toISOString() : null,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        cod: r.cod,
      };

      // Everything except a delivered row is informational and ignored.
      if (r.normalizedStatus !== OrderStatus.DELIVERED) {
        noStatus++;
        return { ...base, match: { kind: 'no_status' } };
      }

      const order = orderByWaybill.get(r.waybill);
      if (!order) {
        notFound++;
        return { ...base, match: { kind: 'not_found' } };
      }

      matched++;
      const current = order.status as OrderStatus;
      const target = r.normalizedStatus;

      let action: 'update' | 'noop' | 'invalid_transition';
      let actionReason: string | undefined;

      if (current === target) {
        action = 'noop';
        actionReason = `Already ${current}`;
        noop++;
      } else if (!isTransitionAllowed(current, target)) {
        action = 'invalid_transition';
        actionReason = `Cannot move ${current} -> ${target}`;
        invalid++;
      } else {
        action = 'update';
        willUpdate++;
      }

      return {
        ...base,
        match: {
          kind: 'matched',
          orderId: order.id,
          orderNumber: order.number,
          currentStatus: current,
          ourCustomerName: order.customerName,
          action,
          actionReason,
        },
      };
    });

    return NextResponse.json({
      items,
      detected: parsed.detected,
      warnings: parsed.warnings,
      totalRows: parsed.totalRows,
      summary: {
        matched,
        notFound,
        noStatus,
        willUpdate,
        noop,
        invalid,
      },
    });
  } catch (error) {
    console.error('Bulk update preview error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate preview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
