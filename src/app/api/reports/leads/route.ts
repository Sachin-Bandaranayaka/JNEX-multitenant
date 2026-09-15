import { parseReportFilters } from '@/lib/report-filters';
// src/app/api/reports/leads/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateLeadReport } from '@/lib/reports'; // <-- Import our secure function

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // 1. Secure the route with session and tenantId check
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Admins or users with permission can view reports
    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('VIEW_REPORTS')) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    // 2. Call our single, secure report generation function
    const reportData = await generateLeadReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      tenantId: session.user.tenantId,
      ...parseReportFilters(searchParams), // Pass the tenantId
    });

    // 3. Return the secure data
    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating leads report:', error);
    return NextResponse.json({ error: 'Failed to generate leads report' }, { status: 500 });
  }
}