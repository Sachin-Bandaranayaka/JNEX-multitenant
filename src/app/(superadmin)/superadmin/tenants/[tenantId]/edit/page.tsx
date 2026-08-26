// src/app/(superadmin)/superadmin/tenants/[tenantId]/edit/page.tsx

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { updateTenant, updateTenantApiKeys } from './actions';
import { Role, ShippingProvider } from '@prisma/client';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, PageHeader, saBtnDark, saBtnPrimary, saInput, saLabel } from '../../../ui';

export default async function EditTenantPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const resolvedParams = await params;
  const { tenantId } = resolvedParams;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { users: { where: { role: Role.ADMIN }, take: 1 } }
  });

  if (!tenant || tenant.users.length === 0) {
    notFound();
  }

  const adminUser = tenant.users[0];
  const updateTenantWithIds = updateTenant.bind(null, tenant.id, adminUser.id);
  const updateApiKeysWithId = updateTenantApiKeys.bind(null, tenant.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tenant configuration"
        title={`Edit ${tenant.name}`}
        description="Update branding and courier credentials for this tenant."
        backHref={`/superadmin/tenants/${tenant.id}`}
        backLabel="Back to tenant"
      />

      {/* Tenant Details Section */}
      <Card title="Branding" description="How this business is presented inside its workspace">
        <form action={updateTenantWithIds} className="max-w-xl space-y-6">
          <div>
            <label htmlFor="businessName" className={saLabel}>Business name</label>
            <input type="text" name="businessName" id="businessName" defaultValue={tenant.businessName || ''} className={`mt-1.5 ${saInput}`} />
          </div>
          <div className="flex items-center justify-end border-t border-slate-200 pt-4">
            <button type="submit" className={saBtnDark}>Save changes</button>
          </div>
        </form>
      </Card>

      {/* Courier API Keys Section - Super Admin Only */}
      <section className="overflow-hidden rounded-md border border-amber-300 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4">
          <div className="rounded-md bg-amber-100 p-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 text-amber-700">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Courier API keys</h2>
            <p className="mt-1 text-xs text-slate-600">Manage shipping provider credentials for this tenant</p>
          </div>
        </div>

        <form action={updateApiKeysWithId} className="max-w-xl space-y-6 p-5">
          {/* Default Shipping Provider */}
          <div>
            <label htmlFor="defaultShippingProvider" className={saLabel}>Default shipping provider</label>
            <select
              id="defaultShippingProvider"
              name="defaultShippingProvider"
              defaultValue={tenant.defaultShippingProvider || ''}
              className={`mt-1.5 ${saInput}`}
            >
              {Object.values(ShippingProvider).map((provider) => (
                <option key={provider} value={provider}>
                  {provider.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Farda Express */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Farda Express</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="fardaExpressClientId" className={saLabel}>Client ID</label>
                <div className="mt-1.5">
                  <PasswordInput name="fardaExpressClientId" id="fardaExpressClientId" defaultValue={tenant.fardaExpressClientId || ''} />
                </div>
              </div>
              <div>
                <label htmlFor="fardaExpressApiKey" className={saLabel}>API key</label>
                <div className="mt-1.5">
                  <PasswordInput name="fardaExpressApiKey" id="fardaExpressApiKey" defaultValue={tenant.fardaExpressApiKey || ''} />
                </div>
              </div>
            </div>
          </div>

          {/* Trans Express */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Trans Express</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="transExpressApiKey" className={saLabel}>API key</label>
                <div className="mt-1.5">
                  <PasswordInput name="transExpressApiKey" id="transExpressApiKey" defaultValue={tenant.transExpressApiKey || ''} />
                </div>
              </div>
              <div>
                <label htmlFor="transExpressOrderPrefix" className={saLabel}>Order prefix</label>
                <input type="text" name="transExpressOrderPrefix" id="transExpressOrderPrefix" defaultValue={tenant.transExpressOrderPrefix || 'JNEX'} placeholder="JNEX" className={`mt-1.5 ${saInput}`} />
              </div>
            </div>
          </div>

          {/* Royal Express */}
          <div className="border-t border-slate-200 pt-6">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">Royal Express</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="royalExpressApiKey" className={saLabel}>Credentials</label>
                <p className="mb-2 mt-1 text-xs text-slate-500">Format: email:password (e.g., user@example.com:yourpassword)</p>
                <PasswordInput name="royalExpressApiKey" id="royalExpressApiKey" defaultValue={tenant.royalExpressApiKey || ''} placeholder="email:password" />
              </div>
              <div>
                <label htmlFor="royalExpressOrderPrefix" className={saLabel}>Order prefix</label>
                <input type="text" name="royalExpressOrderPrefix" id="royalExpressOrderPrefix" defaultValue={tenant.royalExpressOrderPrefix || 'JNEX'} placeholder="JNEX" className={`mt-1.5 ${saInput}`} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-slate-200 pt-4">
            <button type="submit" className={saBtnPrimary}>Update API keys</button>
          </div>
        </form>
      </section>
    </div>
  );
}
