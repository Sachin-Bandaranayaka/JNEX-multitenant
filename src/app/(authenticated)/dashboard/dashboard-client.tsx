'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  ArrowTrendingUpIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LeadsChart } from '@/components/dashboard/leads-chart';

interface DashboardData {
  sales: Array<{ date: string; revenue: number; orders: number }>;
  allTime: { totalLeads: number; convertedLeads: number; conversionRate: number };
  leadsByStatus: Array<{ status: string; count: number }>;
  dailyReview: {
    pendingLeads: number;
    newLeadsToday: number;
    shippedToday: number;
    deliveredToday: number;
    revenueToday: number;
    date: string;
  };
}

type Range = 7 | 30 | 90;
const money = (value: number) => `Rs. ${value.toLocaleString('en-LK', { maximumFractionDigits: 0 })}`;

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardClient({ initialData, userName }: { initialData: DashboardData; userName?: string | null }) {
  const [range, setRange] = useState<Range>(30);
  const [now] = useState(() => new Date());
  const sales = useMemo(() => initialData.sales.slice(-range), [initialData.sales, range]);
  const summary = useMemo(() => {
    const revenue = sales.reduce((sum, item) => sum + item.revenue, 0);
    const orders = sales.reduce((sum, item) => sum + item.orders, 0);
    return { revenue, orders, average: orders ? revenue / orders : 0 };
  }, [sales]);
  const firstName = userName?.trim().split(/\s+/)[0];
  const dailyReviewCards = [
    { label: 'Pending leads', value: initialData.dailyReview.pendingLeads.toLocaleString(), context: 'Current backlog', href: '/leads?status=PENDING&all=1', icon: ClockIcon, accent: 'bg-amber-500', iconStyle: 'bg-amber-50 text-amber-700' },
    { label: 'New leads today', value: initialData.dailyReview.newLeadsToday.toLocaleString(), context: 'Today', href: `/leads?startDate=${initialData.dailyReview.date}&endDate=${initialData.dailyReview.date}`, icon: ArrowTrendingUpIcon, accent: 'bg-sky-600', iconStyle: 'bg-sky-50 text-sky-700' },
    { label: 'Shipped today', value: initialData.dailyReview.shippedToday.toLocaleString(), context: 'Today', href: '/shipping', icon: TruckIcon, accent: 'bg-violet-600', iconStyle: 'bg-violet-50 text-violet-700' },
    { label: 'Delivered today', value: initialData.dailyReview.deliveredToday.toLocaleString(), context: 'Today', icon: CheckCircleIcon, accent: 'bg-teal-600', iconStyle: 'bg-teal-50 text-teal-700' },
    { label: 'Revenue today', value: money(initialData.dailyReview.revenueToday), context: 'Today', icon: CurrencyDollarIcon, accent: 'bg-emerald-600', iconStyle: 'bg-emerald-50 text-emerald-700' },
  ];

  return <main className="space-y-6 pb-8">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-[28px]">{greetingForHour(now.getHours())}{firstName ? `, ${firstName}` : ''}</h1>
        <p className="mt-1.5 text-sm text-slate-500">A clear view of sales and lead conversion.</p>
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><CalendarIcon className="h-4 w-4 text-amber-600" />{format(now, 'EEEE, MMMM d')}</div>
    </header>

    <section aria-label="Daily operational review" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {dailyReviewCards.map(({ label, value, context, href, icon: Icon, accent, iconStyle }) => {
        const content = <>
          <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden="true" />
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-xs font-bold text-slate-600">{label}</span>
              <span className="mt-2 block text-2xl font-extrabold leading-none tracking-tight tabular-nums text-slate-900">{value}</span>
              <span className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{context}</span>
            </span>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${iconStyle}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
          </span>
        </>;
        const className = 'relative min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-3.5 pl-5 shadow-sm transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2';
        return href ? <Link key={label} href={href} className={className} aria-label={`${label}: ${value}. View details`}>{content}</Link> : <article key={label} className={className}>{content}</article>;
      })}
    </section>

    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><h2 className="text-base font-bold text-slate-800">Sales performance</h2><p className="mt-0.5 text-xs text-slate-500">Delivered revenue and orders for the selected period.</p></div>
        <div className="flex w-fit rounded-md border border-slate-300 p-0.5" aria-label="Sales date range">
          {([7, 30, 90] as Range[]).map(value => <button key={value} type="button" onClick={() => setRange(value)} aria-pressed={range === value} className={`rounded px-3 py-1.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${range === value ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{value} days</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
        {[['Delivered sales', money(summary.revenue)], ['Delivered orders', summary.orders.toLocaleString()], ['Average order', money(summary.average)], ['Lead conversion', `${initialData.allTime.conversionRate.toFixed(1)}%`]].map(([label, value]) => <div key={label} className="bg-slate-50 px-4 py-3 sm:px-6"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-lg font-extrabold tabular-nums text-slate-800">{value}</div></div>)}
      </div>
      <div className="h-[310px] px-1 pb-4 pt-6 sm:h-[360px] sm:px-4">
        {summary.orders === 0 ? <div className="flex h-full items-center justify-center px-6 text-center"><div><p className="text-sm font-bold text-slate-700">No delivered sales in this period</p><p className="mt-1 text-xs text-slate-500">Choose a longer range or check back after an order is delivered.</p></div></div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={sales} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs><linearGradient id="salesRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d97706" stopOpacity={0.4}/><stop offset="95%" stopColor="#d97706" stopOpacity={0.03}/></linearGradient><linearGradient id="salesOrders" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f766e" stopOpacity={0.3}/><stop offset="95%" stopColor="#0f766e" stopOpacity={0.02}/></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={28} tickMargin={10} fontSize={11} tick={{ fill: '#64748b' }} tickFormatter={(value) => format(new Date(`${value}T00:00:00`), 'MMM d')} />
          <YAxis yAxisId="revenue" axisLine={false} tickLine={false} width={56} fontSize={11} tick={{ fill: '#64748b' }} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} />
          <YAxis yAxisId="orders" orientation="right" axisLine={false} tickLine={false} width={28} allowDecimals={false} fontSize={11} tick={{ fill: '#64748b' }} />
          <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"><div className="mb-1.5 font-bold text-slate-700">{format(new Date(`${label}T00:00:00`), 'EEEE, MMM d')}</div><div className="flex min-w-40 justify-between gap-5 text-amber-700"><span>Revenue</span><strong>{money(Number(payload.find(p => p.dataKey === 'revenue')?.value ?? 0))}</strong></div><div className="mt-1 flex justify-between gap-5 text-teal-700"><span>Orders</span><strong>{Number(payload.find(p => p.dataKey === 'orders')?.value ?? 0)}</strong></div></div> : null} />
          <Area yAxisId="revenue" dataKey="revenue" name="Revenue" type="monotone" fill="url(#salesRevenue)" stroke="#d97706" strokeWidth={2} />
          <Area yAxisId="orders" dataKey="orders" name="Orders" type="monotone" fill="url(#salesOrders)" stroke="#0f766e" strokeWidth={2} />
        </AreaChart></ResponsiveContainer>}
      </div>
      <div className="flex items-center justify-center gap-5 border-t border-slate-100 py-3 text-xs font-semibold text-slate-600"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-amber-600" />Revenue</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-teal-700" />Orders</span></div>
    </section>

    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4 sm:px-6"><h2 className="text-base font-bold text-slate-800">Lead conversion</h2><p className="mt-0.5 text-xs text-slate-500">All-time lead outcomes at a glance.</p></div>
      <div className="grid items-center gap-3 p-4 sm:p-6 md:grid-cols-[minmax(280px,0.9fr)_minmax(300px,1.1fr)]">
        <LeadsChart data={initialData.leadsByStatus} />
        <div className="border-t border-slate-200 pt-5 md:border-l md:border-t-0 md:pl-8 md:pt-0"><div className="text-3xl font-extrabold tabular-nums text-slate-800">{initialData.allTime.conversionRate.toFixed(1)}%</div><div className="mt-1 text-sm font-bold text-slate-700">Lead conversion rate</div><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{initialData.allTime.convertedLeads.toLocaleString()} of {initialData.allTime.totalLeads.toLocaleString()} leads are confirmed. Select a segment to inspect its total.</p></div>
      </div>
    </section>
  </main>;
}
