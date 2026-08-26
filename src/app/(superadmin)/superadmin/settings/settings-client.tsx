// src/app/(superadmin)/superadmin/settings/settings-client.tsx
'use client';

import { useState } from 'react';
import { ChangePasswordForm } from './change-password-form';
import { CreateAdminForm } from './create-admin-form';
import { User } from '@prisma/client';
import { Badge, Card, EmptyState, PageHeader, saBtnDark } from '../ui';

interface SettingsClientProps {
  currentSession: {
    user: { id: string; tenantId: string; };
  };
  superAdmins: User[];
}

export function SettingsClient({ currentSession, superAdmins }: SettingsClientProps) {
  const [activeForm, setActiveForm] = useState<'password' | 'create' | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Owner security"
        title="Settings"
        description="Manage super admin accounts and your own credentials."
      />

      {/* Super Admin List */}
      <Card title="Current super admins" description={`${superAdmins.length} account${superAdmins.length === 1 ? '' : 's'} with owner access`} flush>
        {superAdmins.length ? (
          <ul className="divide-y divide-slate-200">
            {superAdmins.map(admin => (
              <li key={admin.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{admin.name || 'Super Admin'}</p>
                  <p className="mt-0.5 break-all text-xs text-slate-500">{admin.email}</p>
                </div>
                {admin.id === currentSession.user.id && <Badge tone="green">You</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No super admin accounts found" />
        )}
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Change your password" description="Update the password for your own account.">
          {activeForm === 'password' ? (
            <ChangePasswordForm userId={currentSession.user.id} />
          ) : (
            <button onClick={() => setActiveForm('password')} className={saBtnDark}>Change password</button>
          )}
        </Card>

        {/* <Card title="Create new super admin" description="Create an additional super admin account.">
          {activeForm === 'create' ? (
            <CreateAdminForm tenantId={currentSession.user.tenantId} />
          ) : (
            <button onClick={() => setActiveForm('create')} className={saBtnDark}>Create admin</button>
          )}
        </Card> */}

      </div>
    </div>
  );
}
