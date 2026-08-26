// src/app/(superadmin)/superadmin/settings/create-admin-form.tsx
'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createNewSuperAdmin } from './actions';
import { useEffect, useRef } from 'react';
import { saBtnPrimary, saError, saInput, saLabel, saSuccess } from '../ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={saBtnPrimary}>
      {pending ? 'Creating…' : 'Create admin'}
    </button>
  );
}

export function CreateAdminForm({ tenantId }: { tenantId: string }) {
  const [state, dispatch] = useActionState(createNewSuperAdmin, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.status === 'success') {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form action={dispatch} ref={formRef} className="space-y-4">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div>
        <label htmlFor="name" className={saLabel}>Name</label>
        <input type="text" name="name" id="name" required className={`mt-1.5 ${saInput}`} />
      </div>
      <div>
        <label htmlFor="email" className={saLabel}>Email address</label>
        <input type="email" name="email" id="email" required className={`mt-1.5 ${saInput}`} />
      </div>
      <div>
        <label htmlFor="password" className={saLabel}>Password</label>
        <input type="password" name="password" id="password" autoComplete="new-password" required className={`mt-1.5 ${saInput}`} />
      </div>
      <div className="flex justify-end">
        <SubmitButton />
      </div>
      {state?.status === 'error' && <p role="alert" className={saError}>{state.message || 'An unknown error occurred.'}</p>}
      {state?.status === 'success' && <p className={saSuccess}>{state.message}</p>}
    </form>
  );
}
