import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { exportProductsToExcel, exportProductsToCSV } from '@/lib/bulk-operations';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.tenantId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format')?.toLowerCase() || 'excel';

    let buffer: Buffer | string;
    let filename: string;
    let contentType: string;

    if (format === 'csv') {
      buffer = await exportProductsToCSV(session.user.tenantId);
      filename = 'products.csv';
      contentType = 'text/csv';
    } else {
      buffer = await exportProductsToExcel(session.user.tenantId);
      filename = 'products.xlsx';
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename=${filename}`);

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error('Bulk export error:', error);
    return NextResponse.json(
      { error: 'Failed to export products' },
      { status: 500 }
    );
  }
}
