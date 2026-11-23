import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SuperAdminShell } from './superadmin/superadmin-shell';
import { pendingCounts } from './superadmin/attention';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.originalRole !== 'SUPER_ADMIN') redirect('/auth/signin');
  const counts = await pendingCounts();
  return <SuperAdminShell actorName={session.user.actor?.name || session.user.actor?.email || 'Super Admin'} counts={counts}>{children}</SuperAdminShell>;
}
