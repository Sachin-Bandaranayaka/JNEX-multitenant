// src/app/(superadmin)/superadmin/tenants/[tenantId]/edit/page.tsx

import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { updateTenant, updateTenantApiKeys } from './actions';
import { Role, ShippingProvider } from '@prisma/client';

// export default async function EditTenantPage({ params }: { params: { tenantId: string } }) {
//   const { tenantId } = params;

//   const tenant = await prisma.tenant.findUnique({
//     where: { id: tenantId },
//     include: {
//       users: {
//         where: { role: Role.ADMIN },
//         take: 1,
//       }
//     }
//   });

//   if (!tenant || tenant.users.length === 0) {
//     notFound();
//   }

//   const adminUser = tenant.users[0];
//   const updateTenantWithIds = updateTenant.bind(null, tenant.id, adminUser.id);

//   return (
//     <div className="rounded-lg bg-gray-800/80 p-6 sm:p-8 ring-1 ring-white/10">
//       <h2 className="text-2xl font-bold leading-7 text-white">
//         Edit Tenant: {tenant.name}
//       </h2>
//       <p className="mt-1 text-sm leading-6 text-gray-300">
//         Update the tenant's details and branding settings below.
//       </p>

//       <form action={updateTenantWithIds} className="mt-8 max-w-xl">
//         <div className="space-y-6">
//           <div>
//             <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-200">Internal Tenant Name</label>
//             <div className="mt-2">
//               <input type="text" name="name" id="name" defaultValue={tenant.name} className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500" required />
//             </div>
//           </div>

//           <div>
//             <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-200">Tenant Admin Email</label>
//             <div className="mt-2">
//               <input type="email" name="email" id="email" defaultValue={adminUser.email} className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500" required />
//             </div>
//           </div>

//           {/* --- NEW CUSTOMIZATION FIELDS ADDED HERE --- */}
//           <div className="border-t border-white/10 pt-6">
//             <h3 className="text-base font-semibold leading-7 text-white">Branding</h3>
//             <div className="mt-4 space-y-6">
//                 <div>
//                     <label htmlFor="businessName" className="block text-sm font-medium leading-6 text-gray-200">Business Name</label>
//                     <div className="mt-2">
//                         <input type="text" name="businessName" id="businessName" defaultValue={tenant.businessName || ''} placeholder="e.g., Acme Widgets Inc." className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500" />
//                     </div>
//                 </div>

//                 <div>
//                     <label htmlFor="logoUrl" className="block text-sm font-medium leading-6 text-gray-200">Logo URL</label>
//                     <div className="mt-2">
//                         <input type="text" name="logoUrl" id="logoUrl" defaultValue={tenant.logoUrl || ''} placeholder="https://..." className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500" />
//                     </div>
//                 </div>

//                 <div>
//                     <label htmlFor="primaryColor" className="block text-sm font-medium leading-6 text-gray-200">Primary Color</label>
//                     <div className="mt-2">
//                         <input type="text" name="primaryColor" id="primaryColor" defaultValue={tenant.primaryColor || ''} placeholder="#4f46e5" className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500" />
//                     </div>
//                 </div>
//             </div>
//           </div>

//           <div className="mt-6 flex items-center justify-end gap-x-6">
//             <button type="button" className="text-sm font-semibold leading-6 text-gray-300">Cancel</button>
//             <button type="submit" className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
//               Save Changes
//             </button>
//           </div>
//         </div>
//       </form>
//     </div>
//   );
// }

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
      {/* Tenant Details Section */}
      <div className="rounded-lg bg-gray-800/80 p-6 sm:p-8 ring-1 ring-white/10">
        <h2 className="text-2xl font-bold text-white">Edit Tenant: {tenant.name}</h2>
        <form action={updateTenantWithIds} className="mt-8 max-w-xl">
          <div className="space-y-6">
            <div className="border-t border-white/10 pt-6">
              <h3 className="text-base font-semibold text-white">Branding</h3>
              <div className="mt-4 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-6">
                  <label htmlFor="businessName" className="block text-sm font-medium text-gray-200">Business Name</label>
                  <input type="text" name="businessName" id="businessName" defaultValue={tenant.businessName || ''} className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-x-6">
              <button type="submit" className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400">Save Changes</button>
            </div>
          </div>
        </form>
      </div>

      {/* Courier API Keys Section - Super Admin Only */}
      <div className="rounded-lg bg-gray-800/80 p-6 sm:p-8 ring-1 ring-yellow-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-yellow-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Courier API Keys</h3>
            <p className="text-sm text-gray-400">Manage shipping provider credentials for this tenant</p>
          </div>
        </div>

        <form action={updateApiKeysWithId} className="max-w-xl">
          <div className="space-y-6">
            {/* Default Shipping Provider */}
            <div>
              <label htmlFor="defaultShippingProvider" className="block text-sm font-medium text-gray-200">Default Shipping Provider</label>
              <select
                id="defaultShippingProvider"
                name="defaultShippingProvider"
                defaultValue={tenant.defaultShippingProvider || ''}
                className="mt-2 block w-full rounded-md bg-white/5 py-2 px-3 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"
              >
                {Object.values(ShippingProvider).map((provider) => (
                  <option key={provider} value={provider} className="bg-gray-800">
                    {provider.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Farda Express */}
            <div className="border-t border-white/10 pt-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-4">Farda Express</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fardaExpressClientId" className="block text-sm font-medium text-gray-200">Client ID</label>
                  <input type="text" name="fardaExpressClientId" id="fardaExpressClientId" defaultValue={tenant.fardaExpressClientId || ''} className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label htmlFor="fardaExpressApiKey" className="block text-sm font-medium text-gray-200">API Key</label>
                  <input type="password" name="fardaExpressApiKey" id="fardaExpressApiKey" defaultValue={tenant.fardaExpressApiKey || ''} className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>
            </div>

            {/* Trans Express */}
            <div className="border-t border-white/10 pt-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-4">Trans Express</h4>
              <div>
                <label htmlFor="transExpressApiKey" className="block text-sm font-medium text-gray-200">API Key</label>
                <input type="password" name="transExpressApiKey" id="transExpressApiKey" defaultValue={tenant.transExpressApiKey || ''} className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"/>
              </div>
            </div>

            {/* Royal Express */}
            <div className="border-t border-white/10 pt-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-4">Royal Express</h4>
              <div className="space-y-4">
                <div>
                  <label htmlFor="royalExpressApiKey" className="block text-sm font-medium text-gray-200">Credentials</label>
                  <p className="text-xs text-gray-400 mb-2">Format: email:password (e.g., user@example.com:yourpassword)</p>
                  <input type="password" name="royalExpressApiKey" id="royalExpressApiKey" defaultValue={tenant.royalExpressApiKey || ''} placeholder="email:password" className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"/>
                </div>
                <div>
                  <label htmlFor="royalExpressOrderPrefix" className="block text-sm font-medium text-gray-200">Order Prefix</label>
                  <input type="text" name="royalExpressOrderPrefix" id="royalExpressOrderPrefix" defaultValue={tenant.royalExpressOrderPrefix || 'JNEX'} placeholder="JNEX" className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"/>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-x-6">
              <button type="submit" className="rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500">Update API Keys</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}