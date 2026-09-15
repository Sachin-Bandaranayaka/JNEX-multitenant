'use client';

import { format } from 'date-fns';
import { CheckCircleIcon, ClockIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { OrderHistoryInput, orderHistory, statusLabel, upcomingOrderSteps } from '@/lib/order-presentation';

export function EnhancedOrderTimeline({ order }: { order: OrderHistoryInput & { number?: number } }) {
    const events = orderHistory(order);
    const upcoming = upcomingOrderSteps(order);
    return (
        <section aria-label="Order timeline" className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-foreground">Order timeline{order.number != null ? ` · #${order.number}` : ''}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Recorded order activity and courier updates, oldest first.</p>
            </div>
            <ol className="border-l border-border ml-3 space-y-5">
                {events.map(event => {
                    const date = new Date(event.timestamp);
                    const validDate = !Number.isNaN(date.getTime());
                    return (
                        <li key={event.id} className="relative min-w-0 pl-7 break-words [overflow-wrap:anywhere]">
                            <CheckCircleIcon aria-hidden="true" className="absolute -left-3 top-0.5 h-6 w-6 bg-card text-primary" />
                            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                                <p className="font-semibold text-sm text-foreground">{statusLabel(event.status)}</p>
                                <time dateTime={validDate ? date.toISOString() : undefined} className="text-xs tabular-nums text-muted-foreground">{validDate ? format(date, 'dd MMM yyyy, h:mm a') : 'Date not recorded'}</time>
                            </div>
                            {event.description && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>}
                            {event.location && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPinIcon className="h-3 w-3" />{event.location}</p>}
                            <p className="mt-1 text-xs text-muted-foreground">{event.source}</p>
                        </li>
                    );
                })}
            </ol>
            {upcoming.length > 0 && (
                <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upcoming milestones · not yet recorded</p>
                    <div className="flex flex-wrap gap-3 mt-3">{upcoming.map(step => <span key={step} className="flex items-center gap-1.5 text-sm text-muted-foreground"><ClockIcon className="h-4 w-4" />{statusLabel(step)}</span>)}</div>
                </div>
            )}
        </section>
    );
}
