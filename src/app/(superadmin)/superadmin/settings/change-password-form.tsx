// src/app/(superadmin)/superadmin/settings/change-password-form.tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateSuperAdminPassword } from './actions';
import { useEffect, useRef } from 'react';
import { saBtnPrimary, saError, saInput, saLabel, saSuccess } from '../ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={saBtnPrimary}>
      {pending ? 'Saving…' : 'Save password'}
    </button>
  );
}

export function ChangePasswordForm({ userId }: { userId: string }) {
  const [state, dispatch] = useActionState(updateSuperAdminPassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.status === 'success') {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form action={dispatch} ref={formRef} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <label htmlFor="currentPassword" className={saLabel}>Current password</label>
        <input type="password" name="currentPassword" id="currentPassword" autoComplete="current-password" required className={`mt-1.5 ${saInput}`} />
      </div>
      <div>
        <label htmlFor="newPassword" className={saLabel}>New password</label>
        <input type="password" name="newPassword" id="newPassword" autoComplete="new-password" required className={`mt-1.5 ${saInput}`} />
      </div>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
      {state?.status === 'error' && <p role="alert" className={saError}>{state.message || 'An unknown error occurred.'}</p>}
      {state?.status === 'success' && <p className={saSuccess}>{state.message}</p>}
    </form>
  );
}
