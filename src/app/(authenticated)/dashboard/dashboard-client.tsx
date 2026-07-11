'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { DeliveredOrders } from '@/components/dashboard/delivered-orders';
import { LeadsChart } from '@/components/dashboard/leads-chart';

interface Bucket { count: number; total: number }
interface PeriodStats {
  statusCounts: { total: Bucket; pending: Bucket; shipped: Bucket; returned: Bucket; delivered: Bucket };
  orders: number; revenue: number; leads: number; conversionRate: number; avgOrderValue: number;
}
interface Reminder { id: string; csvData: any; reminderDate: string; reminderNote: string | null; product: { name: string }; assignedTo: { name: string | null } | null }
interface DashboardData {
  operations: { openLeads: number; awaitingShipment: number; awaitingPrint: number; inTransit: number; deliveryExceptions: number; deliveredToday: number; returnedToday: number };
  priorityWork: Array<{ id: string; title: string; detail: string; href: string; action: string; date: string | Date }>;
  daily: PeriodStats; weekly: PeriodStats; monthly: PeriodStats;
  allTime: { totalLeads: number; convertedLeads: number; conversionRate: number };
  leadsByStatus: Array<{ status: string; count: number }>;
  noStockCount: number; lowStockCount: number;
  reminders: { overdue: Reminder[]; today: Reminder[]; upcoming: Reminder[] };
}
type TimeFilter = 'daily' | 'weekly' | 'monthly';

export function DashboardClient({ initialData, userName }: { initialData: DashboardData; userName?: string | null }) {
  const [period, setPeriod] = useState<TimeFilter>('daily');
  const data = initialData[period];
  const finalized = data.statusCounts.delivered.count + data.statusCounts.returned.count;
  const deliveryRate = finalized ? data.statusCounts.delivered.count / finalized * 100 : 0;
  const returnRate = finalized ? data.statusCounts.returned.count / finalized * 100 : 0;
  const money = (value: number) => `Rs. ${value.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;
  const periodLabel = { daily: 'Today', weekly: 'This week', monthly: 'This month' }[period];
  const reminders = [
    ...initialData.reminders.overdue.map(r => ({ ...r, group: 'Overdue', tone: 'bg-red-500' })),
    ...initialData.reminders.today.map(r => ({ ...r, group: 'Today', tone: 'bg-amber-500' })),
    ...initialData.reminders.upcoming.map(r => ({ ...r, group: 'Upcoming', tone: 'bg-teal-500' })),
  ].slice(0, 8);

  return <main className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
      <div><h1 className="text-2xl font-extrabold text-slate-800">Good day{userName ? `, ${userName.split(' ')[0]}` : ''}</h1><p className="mt-1 text-sm text-slate-500">Your operations desk for today.</p></div>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><CalendarIcon className="h-4 w-4 text-amber-600" />{format(new Date(), 'EEEE, MMMM d')}</div>
    </header>

    <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-bold text-slate-800">Today&apos;s control strip</h2><p className="text-xs text-slate-500">Open a queue directly from any number.</p></div>
      <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-5">
        {[
          ['Needs shipping', initialData.operations.awaitingShipment, '/orders?status=CONFIRMED', 'text-amber-700'],
          ['In transit', initialData.operations.inTransit, '/shipping?view=transit', 'text-teal-700'],
          ['Delivered today', initialData.operations.deliveredToday, '/orders?status=DELIVERED', 'text-emerald-700'],
          ['Returned today', initialData.operations.returnedToday, '/returns', 'text-red-700'],
          ['Realized today', money(initialData.daily.statusCounts.delivered.total), '/orders?status=DELIVERED', 'text-emerald-700'],
        ].map(([label,value,href,tone]) => <Link key={label} href={href as string} className="bg-white px-4 py-3 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500"><div className="text-[11px] font-semibold text-slate-500">{label}</div><div className={`mt-1 text-xl font-extrabold tabular-nums ${tone}`}>{value}</div></Link>)}
      </div>
    </section>

    <section className="border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">Today&apos;s work queue</h2><span className="text-xs text-slate-500">Oldest priority first</span></div>
      {initialData.priorityWork.length ? <div className="divide-y divide-slate-200 border-y border-slate-200">{initialData.priorityWork.map((item,index) => <Link key={item.id} href={item.href} className="group flex items-center gap-3 px-1 py-3 hover:bg-slate-50"><span className="flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-xs font-bold text-white">{index+1}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold text-slate-800">{item.title}</div><div className="truncate text-xs text-slate-500">{item.detail} · waiting since {format(new Date(item.date), 'MMM d, h:mm a')}</div></div><span className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800">{item.action}</span></Link>)}</div> : <div className="border-y border-emerald-200 bg-emerald-50 px-3 py-4 text-sm font-semibold text-emerald-800">You&apos;re caught up. No urgent work is waiting.</div>}
    </section>

    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-bold text-slate-800">Performance</h2><p className="text-xs text-slate-500">Revenue counts delivered orders only.</p></div><div className="flex rounded border border-slate-300 p-0.5">{(['daily','weekly','monthly'] as TimeFilter[]).map(value => <button key={value} onClick={() => setPeriod(value)} className={`rounded px-3 py-1.5 text-xs font-bold ${period === value ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{value === 'daily' ? 'Today' : value === 'weekly' ? 'Week' : 'Month'}</button>)}</div></div>
      <div className="grid grid-cols-2 gap-px bg-slate-200 md:grid-cols-4">{[
        ['Orders created', data.orders, 'text-slate-800'], ['Delivered revenue', money(data.revenue), 'text-emerald-700'], ['Delivery rate', `${deliveryRate.toFixed(1)}%`, 'text-emerald-700'], ['Return rate', `${returnRate.toFixed(1)}%`, returnRate > 15 ? 'text-red-700' : 'text-slate-800'],
      ].map(([label,value,tone]) => <div key={label} className="bg-white px-4 py-3"><div className="text-[11px] font-semibold text-slate-500">{label} · {periodLabel}</div><div className={`mt-1 text-lg font-extrabold tabular-nums ${tone}`}>{value}</div></div>)}</div>
    </section>

    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-bold text-slate-800">Operational health</h2><p className="text-xs text-slate-500">Rates use finalized deliveries: delivered + returned.</p></div>
      <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3 lg:grid-cols-6">{[
        ['Delivery rate', `${deliveryRate.toFixed(1)}%`, '/orders?status=DELIVERED', 'text-emerald-700'], ['Return rate', `${returnRate.toFixed(1)}%`, '/returns', 'text-red-700'], ['Pending shipment', initialData.operations.awaitingShipment, '/orders?status=CONFIRMED', 'text-amber-700'], ['Invoice queue', initialData.operations.awaitingPrint, '/orders/print', 'text-amber-700'], ['Low stock', initialData.lowStockCount, '/inventory', 'text-amber-700'], ['Out of stock', initialData.noStockCount, '/inventory', 'text-red-700'],
      ].map(([label,value,href,tone]) => <Link key={label} href={href as string} className="bg-white px-4 py-3 hover:bg-slate-50"><div className="text-[11px] font-semibold text-slate-500">{label}</div><div className={`mt-1 text-lg font-extrabold tabular-nums ${tone}`}>{value}</div></Link>)}</div>
    </section>

    {reminders.length > 0 && <section className="border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><div><h2 className="text-sm font-bold text-slate-800">Lead reminders</h2><p className="text-xs text-slate-500">Follow-ups ordered by urgency.</p></div><Link href="/leads/remind-leads" className="text-xs font-bold text-amber-700 hover:underline">View reminders →</Link></div><div className="divide-y divide-slate-200">{reminders.map(r => <Link key={`${r.group}-${r.id}`} href={`/leads/${r.id}?edit=true`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50"><span className={`h-2 w-2 rounded-full ${r.tone}`} /><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-800">{r.csvData?.name || 'Unknown customer'} <span className="font-normal text-slate-400">· {r.product.name}</span></div><div className="truncate text-xs text-slate-500">{r.reminderNote || r.csvData?.phone || 'Follow up with this lead'}</div></div><div className="text-right"><div className="text-xs font-bold text-slate-700">{r.group}</div><div className="text-[11px] text-slate-500">{format(new Date(r.reminderDate), 'MMM d')}</div></div></Link>)}</div></section>}

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><FunnelIcon className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-bold text-slate-800">Lead conversion</h2></div><div className="mb-3 grid grid-cols-3 gap-px bg-slate-200">{[['Total',initialData.allTime.totalLeads],['Converted',initialData.allTime.convertedLeads],['Rate',`${initialData.allTime.conversionRate.toFixed(1)}%`]].map(([label,value]) => <div key={label} className="bg-slate-50 px-3 py-2"><div className="text-[11px] text-slate-500">{label}</div><div className="font-bold text-slate-800">{value}</div></div>)}</div><div className="h-[260px]"><LeadsChart data={initialData.leadsByStatus} /></div></section>
      <section className="border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-bold text-slate-800">Recent deliveries</h2><Link href="/orders?status=DELIVERED" className="text-xs font-bold text-amber-700 hover:underline">View all →</Link></div><DeliveredOrders /></section>
    </div>
  </main>;
}
