import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { requireTenantAdmin } from '@/lib/authz';
import { auditEventSummary, getTenantAuditLog } from '@/lib/audit-log';

type AuditQuery = { actor?: string; action?: string; from?: string; to?: string; page?: string };
const actionLabel = (action: string) => action.replace(/[_.]/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const controlClass = 'mt-1.5 block w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
const dateFormatter = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' });

export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditQuery> }) {
    const guard = await requireTenantAdmin();
    if (!guard.ok) redirect('/unauthorized');
    const query = await searchParams;
    const result = await getTenantAuditLog(guard.tenantId, query);
    const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
    const pageLink = (page: number) => {
        const params = new URLSearchParams();
        for (const key of ['actor', 'action', 'from', 'to'] as const) {
            if (query[key]) params.set(key, query[key]!);
        }
        params.set('page', String(page));
        return `/audit?${params.toString()}`;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 min-w-0">
            <header className="flex items-start gap-3">
                <ClipboardDocumentListIcon aria-hidden="true" className="mt-1 h-7 w-7 shrink-0 text-primary" />
                <div><h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Audit Log</h1><p className="mt-1 text-sm text-muted-foreground">Review who changed a record, what changed, and when.</p></div>
            </header>

            <form method="get" action="/audit" className="rounded-xl border border-border bg-card p-4 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <label className="min-w-0 text-sm font-medium text-foreground">Staff member
                        <select name="actor" defaultValue={query.actor || ''} className={controlClass}>
                            <option value="">All staff</option>
                            {result.actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name || 'Unnamed staff member'}</option>)}
                        </select>
                    </label>
                    <label className="min-w-0 text-sm font-medium text-foreground">Action
                        <select name="action" defaultValue={query.action || ''} className={controlClass}>
                            <option value="">All actions</option>
                            {result.actions.map(action => <option key={action} value={action}>{actionLabel(action)}</option>)}
                        </select>
                    </label>
                    <label className="min-w-0 text-sm font-medium text-foreground">From date<input type="date" name="from" defaultValue={query.from || ''} className={controlClass} /></label>
                    <label className="min-w-0 text-sm font-medium text-foreground">To date<input type="date" name="to" defaultValue={query.to || ''} className={controlClass} /></label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Apply filters</button>
                    <Link href="/audit" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Clear filters</Link>
                    <p className="text-xs text-muted-foreground sm:ml-auto">Dates and times are shown in Sri Lanka time.</p>
                </div>
            </form>

            <section aria-label="Recorded activity" className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="border-b border-border px-4 sm:px-5 py-4 flex flex-wrap justify-between items-center gap-2"><h2 className="text-base font-semibold text-foreground">Recorded activity</h2><p className="text-sm text-muted-foreground">{result.total.toLocaleString()} {result.total === 1 ? 'event' : 'events'} · newest first</p></div>
                {result.events.length === 0 ? (
                    <div className="px-6 py-14 text-center"><ClipboardDocumentListIcon className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" /><h3 className="mt-3 font-semibold text-foreground">No recorded activity found</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Try a different date range or clear the filters. Only actions recorded by the system are available; earlier activity has not been reconstructed.</p></div>
                ) : (
                    <ol className="divide-y divide-border">
                        {result.events.map(event => {
                            const summary = auditEventSummary(event);
                            const date = new Date(event.createdAt);
                            return (
                                <li key={event.id} className="grid grid-cols-1 gap-3 px-4 py-5 sm:px-5 lg:grid-cols-[11rem_10rem_minmax(0,1fr)] lg:gap-5">
                                    <time dateTime={date.toISOString()} className="text-xs tabular-nums leading-6 text-muted-foreground">{dateFormatter.format(date)}</time>
                                    <p className="min-w-0 break-words text-sm font-semibold leading-6 text-foreground">{event.actor?.name || 'Unknown staff member'}</p>
                                    <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                                        <h3 className="text-sm font-semibold leading-6 text-foreground">{summary.href ? <Link href={summary.href} className="text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{summary.title}</Link> : summary.title}</h3>
                                        {summary.detail && <p className="mt-1 text-sm text-muted-foreground">{summary.detail}</p>}
                                        {summary.changes.length > 0 && <dl className="mt-3 space-y-2">{summary.changes.map((change, index) => <div key={`${change.field}-${index}`} className="rounded-md border border-border bg-muted/20 px-3 py-2"><dt className="text-xs font-medium text-muted-foreground">{change.field}</dt><dd className="mt-1 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2 sm:gap-3"><span className="min-w-0 whitespace-pre-wrap"><span className="mr-1 text-xs text-muted-foreground">Before:</span>{change.before}</span><span className="min-w-0 whitespace-pre-wrap"><span className="mr-1 text-xs text-muted-foreground">After:</span>{change.after}</span></dd></div>)}</dl>}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 sm:px-5 py-4">
                    <p className="text-xs text-muted-foreground">Page {result.page} of {totalPages}{result.total > 0 ? ` · ${(result.page - 1) * result.pageSize + 1}–${Math.min(result.page * result.pageSize, result.total)} of ${result.total}` : ''}</p>
                    <nav aria-label="Audit log pages" className="flex gap-2">
                        {result.page > 1 ? <Link href={pageLink(result.page - 1)} className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Previous</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">Previous</span>}
                        {result.page < totalPages ? <Link href={pageLink(result.page + 1)} className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Next</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">Next</span>}
                    </nav>
                </footer>
            </section>
            <p className="text-xs text-muted-foreground">This log shows saved audit events. Actions performed before auditing was enabled may not appear.</p>
        </div>
    );
}
