import { parseReportFilters } from '@/lib/report-filters';
export const dynamic = 'force-dynamic';

// File: src/app/api/reports/sales/export/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateSalesReport, exportSalesReport } from '@/lib/reports';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // 1. Authenticate and authorize the user
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const canExport = session.user.role === 'ADMIN' || session.user.permissions?.includes('EXPORT_REPORTS');
    if (!canExport) {
      return new NextResponse('Forbidden: You do not have permission to export reports.', { status: 403 });
    }

    // 2. Get parameters from the URL
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'excel'; // Default to excel

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    // 3. Generate the report data using the function from lib/reports.ts
    const reportData = await generateSalesReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      tenantId: session.user.tenantId,
      ...parseReportFilters(searchParams),
    });

    // 4. Convert the data into a file buffer
    const fileBuffer = await exportSalesReport(reportData, format);

    // 5. Set headers to trigger a file download
    let contentType = 'application/octet-stream';
    let fileExtension = 'dat';

    if (format === 'excel') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileExtension = 'xlsx';
    } else if (format === 'csv') {
      contentType = 'text/csv';
      fileExtension = 'csv';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="sales-report-${startDate}-to-${endDate}.${fileExtension}"`);

    return new NextResponse(fileBuffer, { status: 200, headers });

  } catch (error) {
    console.error('Failed to export sales report:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to export sales report', details: errorMessage }, { status: 500 });
  }
}