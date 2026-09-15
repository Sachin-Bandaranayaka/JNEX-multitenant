import { parseReportFilters } from '@/lib/report-filters';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateShippingReport, exportShippingReport } from '@/lib/reports';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId || session.user.role !== 'ADMIN') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const format = searchParams.get('format') || 'excel';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    const reportData = await generateShippingReport({
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      tenantId: session.user.tenantId,
      ...parseReportFilters(searchParams),
    });

    const fileBuffer = await exportShippingReport(reportData, format);

    let contentType = 'application/octet-stream';
    let fileExtension = format;

    if (format === 'excel') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (format === 'pdf') {
        contentType = 'application/pdf';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="product-report.${fileExtension}"`);

    return new NextResponse(fileBuffer, { status: 200, headers });

  } catch (error) {
    console.error('Failed to export product report:', error);
    return NextResponse.json({ error: 'Failed to export product report' }, { status: 500 });
  }
}