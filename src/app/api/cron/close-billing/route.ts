// src/app/api/cron/close-billing/route.ts
//
// Monthly period close. Runs early on the 1st (platform timezone) and issues
// the previous month's invoice to every active tenant. Idempotent, so a retry
// or a manual re-run is harmless.

import { NextResponse } from 'next/server';
import { closePreviousPeriodForAllTenants } from '@/lib/billing/invoicing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const outcome = await closePreviousPeriodForAllTenants();
    const issued = outcome.results.filter((result) => result.issued).length;

    console.log(`Billing close for ${outcome.periodKey}: ${issued}/${outcome.tenantCount} invoices issued`);

    return NextResponse.json(
      { ...outcome, issued },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Billing close failed:', error);
    return NextResponse.json(
      { error: 'Failed to close billing period', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
