import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BulkUpdateClient } from './bulk-update-client';

export const dynamic = 'force-dynamic';

export default async function BulkUpdatePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }
  // Admin-only — matches the API enforcement.
  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return <BulkUpdateClient />;
}
