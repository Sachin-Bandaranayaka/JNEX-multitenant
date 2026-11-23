export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { MagnifyingGlassIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

const labels: Record<string, { label: string; tone: string }> = {
  IMPERSONATION_STARTED: { label: 'Opened workspace', tone: 'bg-amber-100 text-amber-800' },
  TENANT_WORKSPACE_VIEWED: { label: 'Viewed workspace', tone: 'bg-blue-50 text-blue-800' },
  IMPERSONATION_ENDED: { label: 'Closed workspace', tone: 'bg-slate-100 text-slate-700' },
  TENANT_CREATED: { label: 'Tenant created', tone: 'bg-emerald-50 text-emerald-700' },
  TENANT_STATUS_CHANGED: { label: 'Tenant switched on/off', tone: 'bg-red-50 text-red-700' },
  TENANT_REFERRER_TRANSFERRED: { label: 'Tenant moved in referral tree', tone: 'bg-violet-50 text-violet-700' },
  TENANT_BILLING_MODE_CHANGED: { label: 'Billing type changed', tone: 'bg-amber-50 text-amber-800' },
  CREDIT_TOPUP_CONFIRMED: { label: 'Top-up approved', tone: 'bg-emerald-50 text-emerald-700' },
  CREDIT_TOPUP_REJECTED: { label: 'Top-up rejected', tone: 'bg-red-50 text-red-700' },
  CREDIT_ADJUSTED: { label: 'Credits adjusted', tone: 'bg-amber-50 text-amber-800' },
  STOCK_CHANGE_REQUESTED: { label: 'Stock change requested', tone: 'bg-blue-50 text-blue-800' },
  ORDER_STATUS_CHANGED: { label: 'Order status changed', tone: 'bg-slate-100 text-slate-700' },
  ORDER_EDITED: { label: 'Order edited', tone: 'bg-slate-100 text-slate-700' },
  LEADS_IMPORTED: { label: 'Leads imported', tone: 'bg-slate-100 text-slate-700' },
  LEADS_ASSIGNED: { label: 'Leads assigned', tone: 'bg-slate-100 text-slate-700' },
  STAFF_ACCOUNT_UPDATED: { label: 'Staff account changed', tone: 'bg-slate-100 text-slate-700' },
  STAFF_ACCOUNT_DEACTIVATED: { label: 'Staff account switched off', tone: 'bg-red-50 text-red-700' },
  PASSWORD_RESET_COMPLETED: { label: 'Password reset', tone: 'bg-violet-50 text-violet-700' },
  SUPER_ADMIN_CREATED: { label: 'Super admin added', tone: 'bg-violet-50 text-violet-700' },
  SUPER_ADMIN_PASSWORD_CHANGED: { label: 'Password changed', tone: 'bg-violet-50 text-violet-700' },
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; tenant?: string }> }) {
  const params = await searchParams; const q = params.q?.trim() || ''; const action = params.action || ''; const tenantId = params.tenant || '';
  const [events, tenants] = await Promise.all([
    prisma.auditEvent.findMany({ where: { ...(action ? { action } : {}), ...(tenantId ? { tenantId } : {}), ...(q ? { OR: [{ actor: { email: { contains: q, mode: 'insensitive' } } }, { actor: { name: { contains: q, mode: 'insensitive' } } }, { tenant: { name: { contains: q, mode: 'insensitive' } } }, { entityId: { contains: q, mode: 'insensitive' } }] } : {}) }, orderBy: { createdAt: 'desc' }, take: 250, select: { id: true, action: true, entityType: true, entityId: true, metadata: true, ipAddress: true, userAgent: true, createdAt: true, impersonationSessionId: true, actor: { select: { name: true, email: true } }, tenant: { select: { id: true, name: true } } } }),
    prisma.tenant.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return <div className="space-y-6"><div className="border-b border-slate-300 pb-6"><h1 className="text-2xl font-bold">Activity log</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Important actions by super admins and tenant staff, newest first. Shows the latest 250.</p></div>
    <form className="grid gap-3 rounded-md border border-slate-300 bg-white p-4 shadow-sm lg:grid-cols-[1fr_220px_220px_auto]"><label className="relative"><span className="sr-only">Search audit records</span><MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input name="q" defaultValue={q} placeholder="Search by person or tenant" className="w-full rounded-md border-slate-300 py-2 pl-9 text-sm focus:border-red-500 focus:ring-red-500" /></label><select name="action" defaultValue={action} aria-label="Event type" className="rounded-md border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"><option value="">All actions</option>{Object.entries(labels).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</select><select name="tenant" defaultValue={tenantId} aria-label="Tenant" className="rounded-md border-slate-300 text-sm focus:border-red-500 focus:ring-red-500"><option value="">All tenants</option>{tenants.map((t) => <option value={t.id} key={t.id}>{t.name}</option>)}</select><button className="rounded-md bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-700">Search</button></form>
    <div className="overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">{events.length ? <div className="divide-y divide-slate-200">{events.map((event) => { const detail = labels[event.action] || { label: event.action.replaceAll('_', ' ').toLowerCase(), tone: 'bg-slate-100 text-slate-700' }; const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {}; return <article key={event.id} title={[event.ipAddress && `IP ${event.ipAddress}`, event.userAgent].filter(Boolean).join(' · ') || undefined} className="grid gap-3 px-5 py-4 hover:bg-slate-50 lg:grid-cols-[220px_220px_1fr]"><div><span className={`inline-flex rounded px-2 py-1 text-[11px] font-bold ${detail.tone}`}>{detail.label}</span><p className="mt-2 text-[11px] text-slate-500">{event.createdAt.toISOString().replace('T', ' ').slice(0, 19)} UTC</p></div><div><p className="text-sm font-bold">{event.actor.name || 'Super Admin'}</p><p className="mt-1 break-all text-xs text-slate-500">{event.actor.email}</p></div><div><p className="text-sm font-semibold">{event.tenant ? <Link href={`/superadmin/tenants/${event.tenant.id}`} className="hover:text-[#c50500] hover:underline">{event.tenant.name}</Link> : 'Super admin'}</p>{typeof metadata.reason === 'string' && <p className="mt-1 text-xs leading-5 text-slate-600">Reason: {metadata.reason}</p>}</div></article>; })}</div> : <div className="px-5 py-16 text-center"><ShieldCheckIcon className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold">No audit events found</p><p className="mt-1 text-sm text-slate-500">Actions will show up here as they happen.</p></div>}</div>
  </div>;
}
