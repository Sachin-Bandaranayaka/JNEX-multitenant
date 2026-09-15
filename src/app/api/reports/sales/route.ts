import { parseReportFilters } from '@/lib/report-filters';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateSalesReport } from '@/lib/reports';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    
    // --- FIX: Check for VIEW_REPORTS permission, not EXPORT_REPORTS ---
    // This allows users with view permissions to load the report data.
    const canView = session.user.role === 'ADMIN' || session.user.permissions?.includes('VIEW_REPORTS');
    if (!canView) {
        return new NextResponse('Forbidden: You do not have permission to view reports.', { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    const reportData = await generateSalesReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      tenantId: session.user.tenantId,
      ...parseReportFilters(searchParams),
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating sales report API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to generate sales report', details: errorMessage }, { status: 500 });
  }
}