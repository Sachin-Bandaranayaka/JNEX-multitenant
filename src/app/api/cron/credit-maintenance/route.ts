// src/app/api/cron/credit-maintenance/route.ts
//
// Daily housekeeping for prepaid wallets: low-balance warnings, stranded holds
// returned, and a reconciliation pass proving the running balances still match
// the ledger. Read-mostly and idempotent, so re-running it is harmless.

import { NextResponse } from 'next/server';
import { runCreditMaintenance } from '@/lib/billing/credits';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET_KEY;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const report = await runCreditMaintenance();

    // Drift means a running balance disagrees with the sum of its own ledger.
    // Nothing else in this system can cause that, so it is worth shouting about.
    if (report.drifted.length > 0) {
      console.error('Credit balance drift detected:', report.drifted);
    }
    console.log(
      `Credit maintenance: ${report.checked} prepaid tenants, ${report.notified.length} warned, ` +
        `${report.staleHoldsReleased.length} stale holds released, ${report.drifted.length} drifted`,
    );

    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Credit maintenance failed:', error);
    return NextResponse.json(
      { error: 'Credit maintenance failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
