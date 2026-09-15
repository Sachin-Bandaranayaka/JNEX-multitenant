import { parseReportFilters } from '@/lib/report-filters';
// src/app/api/reports/shipping/route.ts

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { generateShippingReport, exportShippingReport } from '@/lib/reports';
import { z } from 'zod';
import { ShippingProvider } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Update schema to allow null/undefined for optional fields
const QuerySchema = z.object({
  startDate: z.string().transform(str => new Date(str)),
  endDate: z.string().transform(str => new Date(str)),
  provider: z.nativeEnum(ShippingProvider).optional().nullable(),
  format: z.enum(['json', 'excel', 'pdf', 'csv']).optional().default('json'),
});

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // 1. Check for session and tenantId
    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (session.user.role !== 'ADMIN' && !session.user.permissions?.includes('VIEW_REPORTS')) return new NextResponse('Forbidden', {status:403});
    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      provider: searchParams.get('provider'),
      format: searchParams.get('format') || 'json',
    });

    // 2. Pass tenantId to the secure report function
    const report = await generateShippingReport({
      startDate: query.startDate,
      endDate: query.endDate,
      provider: query.provider,
      tenantId: session.user.tenantId,
      ...parseReportFilters(searchParams),
    });

    if (query.format !== 'json' && session.user.role !== 'ADMIN' && !session.user.permissions?.includes('EXPORT_REPORTS')) return new NextResponse('Forbidden', {status:403});
    if (query.format === 'json') {
      return NextResponse.json(report);
    }

    const buffer = await exportShippingReport(report, query.format);
    const headers = new Headers();
    headers.set('Content-Type', getContentType(query.format));
    headers.set(
      'Content-Disposition',
      `attachment; filename=shipping-report.${getFileExtension(query.format)}`
    );

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('Shipping report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate shipping report' },
      { status: 500 }
    );
  }
}

function getContentType(format: string): string {
  switch (format) {
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
      return 'application/pdf';
    case 'csv':
      return 'text/csv';
    default:
      return 'application/json';
  }
}

function getFileExtension(format: string): string {
  switch (format) {
    case 'excel':
      return 'xlsx';
    case 'pdf':
      return 'pdf';
    case 'csv':
      return 'csv';
    default:
      return 'json';
  }
}
