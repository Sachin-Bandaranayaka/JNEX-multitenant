// src/app/(superadmin)/superadmin/tenants/[tenantId]/edit/page.tsx

import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { updateTenant } from './actions';
import { Role } from '@prisma/client';

interface EditTenantPageProps {
  params: { tenantId: string };
}

// export default async function EditTenantPage({ params }: EditTenantPageProps) {
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

  return (
    <div className="rounded-lg bg-gray-800/80 p-6 sm:p-8 ring-1 ring-white/10">
      <h2 className="text-2xl font-bold text-white">Edit Tenant: {tenant.name}</h2>
      <form action={updateTenantWithIds} className="mt-8 max-w-xl">
        <div className="space-y-6">
          {/* ... Tenant Name and Admin Email fields ... */}
          
          <div className="border-t border-white/10 pt-6">
            <h3 className="text-base font-semibold text-white">Branding</h3>
            <div className="mt-4 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-6"><label htmlFor="businessName" className="block text-sm font-medium text-gray-200">Business Name</label><input type="text" name="businessName" id="businessName" defaultValue={tenant.businessName || ''} className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"/></div>
                {/* <div className="sm:col-span-6"><label htmlFor="logoUrl" className="block text-sm font-medium text-gray-200">Logo URL</label><input type="text" name="logoUrl" id="logoUrl" defaultValue={tenant.logoUrl || ''} className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500"/></div> */}
                
                {/* --- NEW COLOR FIELDS --- */}
                {/* <div className="sm:col-span-2"><label htmlFor="backgroundColor" className="block text-sm font-medium text-gray-200">Background Color</label><input type="text" name="backgroundColor" id="backgroundColor" defaultValue={tenant.backgroundColor || ''} placeholder="#F9FAFB" className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10"/></div>
                <div className="sm:col-span-2"><label htmlFor="cardColor" className="block text-sm font-medium text-gray-200">Card Color</label><input type="text" name="cardColor" id="cardColor" defaultValue={tenant.cardColor || ''} placeholder="#FFFFFF" className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10"/></div>
                <div className="sm:col-span-2"><label htmlFor="fontColor" className="block text-sm font-medium text-gray-200">Font Color</label><input type="text" name="fontColor" id="fontColor" defaultValue={tenant.fontColor || ''} placeholder="#111827" className="mt-2 block w-full rounded-md bg-white/5 py-1.5 text-white ring-1 ring-inset ring-white/10"/></div> */}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-x-6">
            <button type="submit" className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-400">Save Changes</button>
          </div>
        </div>
      </form>
    </div>
  );
}