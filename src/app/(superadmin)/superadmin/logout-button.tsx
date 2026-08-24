// src/app/(superadmin)/superadmin/logout-button.tsx
'use client';

import { signOut } from 'next-auth/react';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/auth/signin' })}
      className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400"
    >
      <ArrowLeftOnRectangleIcon className="h-5 w-5" />
      <span>Log out</span>
    </button>
  );
}
