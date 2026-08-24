import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { SuperAdminShell } from './superadmin/superadmin-shell';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.originalRole !== 'SUPER_ADMIN') redirect('/auth/signin');
  return <SuperAdminShell actorName={session.user.actor?.name || session.user.actor?.email || 'Super Admin'}>{children}</SuperAdminShell>;
}
