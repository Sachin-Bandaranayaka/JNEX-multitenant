'use client';

import Link from 'next/link';
import { format, isPast, isToday } from 'date-fns';
import { BellAlertIcon, ClockIcon, PhoneIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';

interface RemindLead {
  id: string;
  number: number;
  csvData: any;
  product: { name: string; code: string };
  assignedTo: { name: string | null } | null;
  status: string;
  reminderDate: string;
  reminderNote: string | null;
}

export function RemindLeadsClient({ leads }: { leads: RemindLead[] }) {
  const overdue = leads.filter((l) => isPast(new Date(l.reminderDate)) && !isToday(new Date(l.reminderDate)));
  const today = leads.filter((l) => isToday(new Date(l.reminderDate)));
  const upcoming = leads.filter((l) => !isPast(new Date(l.reminderDate)) && !isToday(new Date(l.reminderDate)));

  const renderTable = (items: RemindLead[], title: string, color: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h2 className={`text-sm font-semibold ${color} flex items-center gap-2`}>
          <BellAlertIcon className="h-4 w-4" /> {title} ({items.length})
        </h2>
        <div className="bg-white dark:bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Lead #</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Customer</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Phone</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden md:table-cell">Product</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Reminder Date</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden lg:table-cell">Note</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs hidden xl:table-cell">Staff</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {items.map((lead) => {
                const csv = lead.csvData;
                const phone = csv?.phone || '';
                const cleaned = phone.replace(/[^0-9+]/g, '');
                return (
                  <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2">
                      <Link href={`/leads/${lead.id}`} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">
                        {lead.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium text-foreground">{csv?.name || 'Unnamed'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{phone}</td>
                    <td className="px-3 py-2 text-muted-foreground hidden md:table-cell text-xs">{lead.product.code}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                        isPast(new Date(lead.reminderDate)) && !isToday(new Date(lead.reminderDate))
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : isToday(new Date(lead.reminderDate))
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        <ClockIcon className="h-3 w-3" />
                        {format(new Date(lead.reminderDate), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
                      {lead.reminderNote || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground hidden xl:table-cell">{lead.assignedTo?.name || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <a href={`https://wa.me/${cleaned.startsWith('+') ? cleaned.slice(1) : cleaned}`} target="_blank" rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-700"><ChatBubbleLeftIcon className="h-4 w-4" /></a>
                        <a href={`tel:${cleaned}`} className="text-blue-600 hover:text-blue-700"><PhoneIcon className="h-4 w-4" /></a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Remind Leads</h1>
        <p className="text-sm text-muted-foreground">Leads with scheduled reminders for follow-up</p>
      </div>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <BellAlertIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground">No reminders scheduled</h3>
          <p className="text-sm text-muted-foreground mt-1">Set reminder dates on leads to see them here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {renderTable(overdue, 'Overdue', 'text-red-600 dark:text-red-400')}
          {renderTable(today, 'Today', 'text-orange-600 dark:text-orange-400')}
          {renderTable(upcoming, 'Upcoming', 'text-blue-600 dark:text-blue-400')}
        </div>
      )}
    </div>
  );
}
