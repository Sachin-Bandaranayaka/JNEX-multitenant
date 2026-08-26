// src/app/(superadmin)/superadmin/create/create-tenant-form.tsx

'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createTenant } from './actions';
import { Tenant } from '@prisma/client';
import { Card, saBtnPrimary, saError, saInput, saLabel } from '../ui';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={saBtnPrimary}>
      {pending ? 'Creating…' : 'Create tenant'}
    </button>
  );
}

// The form now accepts the list of tenants as a prop
export function CreateTenantForm({ tenants }: { tenants: Tenant[] }) {
  const [state, dispatch] = useActionState(createTenant, undefined);

  return (
    <form action={dispatch} className="max-w-2xl space-y-6">
      <Card title="Tenant information" description="Identifies the business inside the platform">
        <div className="space-y-5">
          <div>
            <label htmlFor="tenantName" className={saLabel}>Internal tenant name</label>
            <input type="text" name="tenantName" id="tenantName" className={`mt-1.5 ${saInput}`} required />
            {state?.errors?.tenantName && <p className={saError}>{state.errors.tenantName}</p>}
          </div>

          <div>
            <label htmlFor="referredById" className={saLabel}>Referred by (optional)</label>
            <select name="referredById" id="referredById" className={`mt-1.5 ${saInput}`}>
              <option value="">None</option>
              {tenants.map(tenant => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card title="Tenant admin user" description="The first account able to sign in for this tenant">
        <div className="space-y-5">
          <div>
            <label htmlFor="adminName" className={saLabel}>Admin name</label>
            <input type="text" name="adminName" id="adminName" className={`mt-1.5 ${saInput}`} required />
            {state?.errors?.adminName && <p className={saError}>{state.errors.adminName}</p>}
          </div>
          <div>
            <label htmlFor="adminEmail" className={saLabel}>Admin email</label>
            <input type="email" name="adminEmail" id="adminEmail" className={`mt-1.5 ${saInput}`} required />
            {state?.errors?.adminEmail && <p className={saError}>{state.errors.adminEmail}</p>}
          </div>
          <div>
            <label htmlFor="adminPassword" className={saLabel}>Admin password</label>
            <input type="password" name="adminPassword" id="adminPassword" className={`mt-1.5 ${saInput}`} required />
            {state?.errors?.adminPassword && <p className={saError}>{state.errors.adminPassword}</p>}
          </div>
        </div>
      </Card>

      {state?.message && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.message}</p>}

      <div className="flex items-center justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
