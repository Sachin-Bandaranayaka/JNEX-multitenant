'use client';

import { Popover, Transition } from '@headlessui/react';
import { BellIcon } from '@heroicons/react/24/outline';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

type Notification = { id: string; title: string; description: string; type: string; read: boolean; createdAt: string; orderId?: string };
type Workload = { pendingLeads: number | null; dueReminders: number | null; lowStockProducts: number | null; scope: 'assigned' | 'tenant' };

export function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [marking, setMarking] = useState(false);
    const [workload, setWorkload] = useState<Workload | null>(null);
    const [workloadState, setWorkloadState] = useState<'loading' | 'ready' | 'error' | 'hidden'>('loading');
    const active = useRef(false);
    const historyRequest = useRef<AbortController | null>(null);
    const workloadRequest = useRef<AbortController | null>(null);
    const writes = useRef(new Set<AbortController>());
    const router = useRouter();

    const fetchNotifications = useCallback(async () => {
        historyRequest.current?.abort();
        const controller = new AbortController();
        historyRequest.current = controller;
        try {
            const res = await fetch('/api/notifications', { cache: 'no-store', signal: controller.signal });
            if (!res.ok) throw new Error('Unable to load notification history.');
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Unable to load notification history.');
            if (active.current && !controller.signal.aborted) { setNotifications(data); setHistoryError(null); }
        } catch {
            if (active.current && !controller.signal.aborted) setHistoryError('Unable to refresh notification history.');
        } finally {
            if (active.current && !controller.signal.aborted) setLoading(false);
        }
    }, []);

    const fetchWorkload = useCallback(async () => {
        workloadRequest.current?.abort();
        const controller = new AbortController();
        workloadRequest.current = controller;
        try {
            const res = await fetch('/api/notifications/workload', { cache: 'no-store', signal: controller.signal });
            if (res.status === 403) {
                if (active.current && !controller.signal.aborted) { setWorkload(null); setWorkloadState('hidden'); }
                return;
            }
            if (!res.ok) throw new Error('Unable to load workload.');
            const data = await res.json();
            if (!['assigned', 'tenant'].includes(data.scope) || ![data.pendingLeads, data.dueReminders, data.lowStockProducts].every(count => count === null || (Number.isInteger(count) && count >= 0))) throw new Error('Invalid workload response.');
            if (active.current && !controller.signal.aborted) { setWorkload(data); setWorkloadState('ready'); }
        } catch {
            if (active.current && !controller.signal.aborted) { setWorkload(null); setWorkloadState('error'); }
        }
    }, []);

    useEffect(() => {
        active.current = true;
        const refresh = () => { fetchNotifications(); fetchWorkload(); };
        refresh();
        const interval = window.setInterval(refresh, 60_000);
        window.addEventListener('focus', refresh);
        return () => {
            active.current = false;
            window.clearInterval(interval);
            window.removeEventListener('focus', refresh);
            historyRequest.current?.abort();
            workloadRequest.current?.abort();
            writes.current.forEach(controller => controller.abort());
        };
    }, [fetchNotifications, fetchWorkload]);

    const markAsRead = async (id?: string) => {
        if (marking) return;
        setMarking(true);
        const controller = new AbortController();
        writes.current.add(controller);
        try {
            const response = await fetch('/api/notifications', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(id ? { id } : { markAllRead: true }), signal: controller.signal,
            });
            if (!response.ok) throw new Error('Could not mark notifications as read.');
            if (active.current && !controller.signal.aborted) {
                historyRequest.current?.abort();
                setNotifications(prev => prev.map(notification => !id || notification.id === id ? { ...notification, read: true } : notification));
                setHistoryError(null);
            }
        } catch {
            if (active.current && !controller.signal.aborted) setHistoryError('Could not mark notifications as read. Please try again.');
        } finally {
            writes.current.delete(controller);
            if (active.current && !controller.signal.aborted) setMarking(false);
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) await markAsRead(notification.id);
        if (active.current && notification.orderId) router.push(`/orders/${notification.orderId}`);
    };
    const unreadCount = notifications.filter(notification => !notification.read).length;
    const workloadLinks = workload ? [
        { count: workload.pendingLeads, label: workload.scope === 'assigned' ? 'Your pending leads' : 'Pending leads', href: '/leads' },
        { count: workload.dueReminders, label: 'Due lead reminders', href: '/leads/remind-leads' },
        { count: workload.lowStockProducts, label: 'Low-stock products', href: '/inventory' },
    ].filter(item => item.count !== null) : [];
    const workloadCategories = workloadLinks.filter(item => (item.count ?? 0) > 0).length;

    return (
        <Popover className="relative">
            {({ open, close }) => <>
                <Popover.Button aria-label="Notifications" title={`${unreadCount} unread notifications${workloadState === 'ready' ? `; ${workloadCategories} current workload categories need attention` : ''}`} onClick={() => { if (!open) { fetchNotifications(); fetchWorkload(); } }} className={`relative rounded-full p-2 text-gray-200 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-300 ${open ? 'bg-white/10 text-white' : ''}`}>
                    <BellIcon className="h-5 w-5" aria-hidden="true" />
                    {unreadCount > 0 && <span aria-hidden="true" className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />}
                    {workloadCategories > 0 && <span className="sr-only">{workloadCategories} workload categories need attention.</span>}
                </Popover.Button>
                <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                    <Popover.Panel className="fixed left-4 right-4 z-50 mt-2 sm:absolute sm:left-auto sm:right-0 sm:w-80">
                        <div className="max-h-[75vh] overflow-y-auto rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10">
                            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
                            {workloadState !== 'hidden' && <section aria-label="Current workload" className="mt-4 border-b border-border pb-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current workload</h3>
                                <p className="mt-1 text-xs text-muted-foreground">Live counts update as work is resolved. These are separate from unread notifications.</p>
                                {workloadState === 'loading' ? <p role="status" className="mt-3 text-xs text-muted-foreground">Loading current workload…</p> : workloadState === 'error' ? <div role="alert" className="mt-3"><p className="text-xs text-destructive">Current workload could not be refreshed.</p><button onClick={fetchWorkload} className="mt-2 text-xs font-medium text-primary underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Retry workload</button></div> : <div className="mt-3 space-y-1">
                                    {workloadLinks.map(item => <Link key={item.href} href={item.href} onClick={() => close()} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><span>{item.label}</span><span className={`shrink-0 font-semibold tabular-nums ${(item.count ?? 0) > 0 ? 'text-primary' : 'text-muted-foreground'}`}>{item.count?.toLocaleString()}</span></Link>)}
                                </div>}
                            </section>}
                            <section aria-label="Notification history" className="mt-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</h3><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{unreadCount} unread</span>{unreadCount > 0 && <button disabled={marking} onClick={() => markAsRead()} className="text-xs text-primary hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Mark all read</button>}</div></div>
                                {historyError && <div role="alert" className="mb-3 text-xs text-destructive"><p>{historyError}</p><button onClick={fetchNotifications} className="mt-1 text-primary underline underline-offset-2">Refresh history</button></div>}
                                <div className="space-y-1">
                                    {loading ? <p className="py-4 text-center text-xs text-muted-foreground">Loading history…</p> : notifications.length === 0 ? !historyError && <p className="py-4 text-center text-xs text-muted-foreground">No notifications</p> : notifications.map(notification => <button key={notification.id} disabled={marking} onClick={() => handleNotificationClick(notification)} className={`flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${!notification.read ? 'bg-accent/20' : ''}`}>
                                        <span aria-hidden="true" className={`mt-1 h-2 w-2 shrink-0 rounded-full ${!notification.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                        <span className="min-w-0 break-words"><span className={`block text-sm ${!notification.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{notification.title}</span><span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">{notification.description}</span><span className="mt-1 block text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}</span></span>
                                    </button>)}
                                </div>
                            </section>
                        </div>
                    </Popover.Panel>
                </Transition>
            </>}
        </Popover>
    );
}
