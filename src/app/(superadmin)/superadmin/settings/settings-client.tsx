// src/app/(superadmin)/superadmin/settings/settings-client.tsx
'use client';

import { useState } from 'react';
import { ChangePasswordForm } from './change-password-form';
import { CreateAdminForm } from './create-admin-form';
import { User } from '@prisma/client';

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
      <div>
        <h1 className="text-2xl font-bold leading-6 text-white">Settings</h1>
        <p className="mt-2 text-sm text-gray-300">Manage super admin accounts and your credentials.</p>
      </div>

      {/* Super Admin List */}
      <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
        <h2 className="text-lg font-semibold text-white">Current Super Admins</h2>
        <ul className="mt-4 divide-y divide-gray-700">
          {superAdmins.map(admin => (
            <li key={admin.id} className="py-2">
              <p className="text-sm font-medium text-white">{admin.name}</p>
              <p className="text-sm text-gray-400">{admin.email}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <h2 className="text-lg font-semibold text-white">Change Your Password</h2>
          <p className="text-sm text-gray-400 mt-1">Update the password for your own account.</p>
          <div className="mt-6 border-t border-white/10 pt-6">
            {activeForm === 'password' ? (
              <ChangePasswordForm userId={currentSession.user.id} />
            ) : (
              <button onClick={() => setActiveForm('password')} className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400">Change Password</button>
            )}
          </div>
        </div>

        {/* <div className="rounded-lg bg-gray-800/80 p-6 ring-1 ring-white/10">
          <h2 className="text-lg font-semibold text-white">Create New Super Admin</h2>
          <p className="text-sm text-gray-400 mt-1">Create an additional super admin account.</p>
          <div className="mt-6 border-t border-white/10 pt-6">
            {activeForm === 'create' ? (
              <CreateAdminForm tenantId={currentSession.user.tenantId} />
            ) : (
              <button onClick={() => setActiveForm('create')} className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400">Create Admin</button>
            )}
          </div>
        </div> */}
        
      </div>
    </div>
  );
}