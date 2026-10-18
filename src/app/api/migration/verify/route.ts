import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasMigrationBypass, isMigrationMaintenance } from '@/lib/migration-maintenance';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await hasMigrationBypass(request.headers))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const [database] = await prisma.$queryRaw<Array<{ name: string; readOnly: string }>>`
    SELECT current_database() AS name, current_setting('transaction_read_only') AS "readOnly"
  `;
  return NextResponse.json({
    provider: new URL(process.env.DATABASE_URL!).hostname.endsWith('.neon.tech') ? 'neon' : 'rds',
    database: database.name,
    readOnly: database.readOnly === 'on',
    maintenance: isMigrationMaintenance(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
