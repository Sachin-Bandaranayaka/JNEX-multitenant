import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { toggleTenantStatus, deleteTenant } from '../actions'; 

// This is a Server Component, so it can be async and fetch data directly.
export default async function SuperAdminUsersPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      referredBy: {
        select: {
          name: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold leading-6 text-white">
            Tenant Management
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            A list of all tenant accounts in your system.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            href="/superadmin/create"
            className="block rounded-md bg-indigo-500 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-400"
          >
            Create Tenant
          </Link>
        </div>
      </div>

      <div className="flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-white/10 rounded-lg">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6">Name</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Status</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Referred By</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-white">Date Created</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">{tenant.name}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400">
                        {tenant.isActive ? (
                          <span className="inline-flex items-center rounded-md bg-green-900/50 px-2 py-1 text-xs font-medium text-green-300 ring-1 ring-inset ring-green-500/50">Active</span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-red-900/50 px-2 py-1 text-xs font-medium text-red-300 ring-1 ring-inset ring-red-500/50">Inactive</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400">{tenant.referredBy?.name ?? 'Direct'}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400">
                        {/* FIX: Use a consistent date format (YYYY-MM-DD) to prevent hydration errors. */}
                        {new Date(tenant.createdAt).toISOString().split('T')[0]}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        {(tenant.name !== 'Master Tenant' && tenant.name !== 'J-nex Holdings Master') && (
                          <div className="flex items-center justify-end gap-x-4">
                            <Link href={`/superadmin/tenants/${tenant.id}/edit`} className="text-indigo-400 hover:text-indigo-300">Edit</Link>
                            <form action={toggleTenantStatus}>
                              <input type="hidden" name="tenantId" value={tenant.id} />
                              <input type="hidden" name="isActive" value={String(tenant.isActive)} />
                              <button type="submit" className={tenant.isActive ? "text-yellow-400 hover:text-yellow-300" : "text-green-400 hover:text-green-300"}>
                                {tenant.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </form>
                            <form action={deleteTenant}>
                                <input type="hidden" name="tenantId" value={tenant.id} />
                                <button type="submit" className="text-red-500 hover:text-red-400">
                                    Delete
                                </button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
