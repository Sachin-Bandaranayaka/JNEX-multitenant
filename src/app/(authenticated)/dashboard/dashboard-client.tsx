'use client';

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LeadsChart } from '@/components/dashboard/leads-chart';

interface SummaryBucket { count: number; total: number }
interface OrderSummary {
  total: SummaryBucket;
  pending: SummaryBucket;
  shipped: SummaryBucket;
  returned: SummaryBucket;
  delivered: SummaryBucket;
}

type SummaryPeriod = 'today' | 'week' | 'month' | 'firstHalf' | 'secondHalf';

interface DashboardData {
  sales: Array<{ date: string; revenue: number; orders: number }>;
  allTime: { totalLeads: number; convertedLeads: number; conversionRate: number };
  leadsByStatus: Array<{ status: string; count: number }>;
  orderSummaries: Record<SummaryPeriod, OrderSummary>;
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
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>('today');
  const [now] = useState(() => new Date());
  const sales = useMemo(() => initialData.sales.slice(-range), [initialData.sales, range]);
  const summary = useMemo(() => {
    const revenue = sales.reduce((sum, item) => sum + item.revenue, 0);
    const orders = sales.reduce((sum, item) => sum + item.orders, 0);
    return { revenue, orders, average: orders ? revenue / orders : 0 };
  }, [sales]);
  const firstName = userName?.trim().split(/\s+/)[0];
  const activeOrderSummary = initialData.orderSummaries[summaryPeriod];
  const summaryFilters: Array<{ value: SummaryPeriod; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'firstHalf', label: 'This Month 1st Half' },
    { value: 'secondHalf', label: 'This Month 2nd Half' },
  ];
  const orderCards: Array<{ label: string; bucket: keyof OrderSummary; style: string }> = [
    { label: 'Total Orders', bucket: 'total', style: 'bg-[#e10600] text-white border-[#e10600]' },
    { label: 'Pending Orders', bucket: 'pending', style: 'bg-white text-slate-800 border-[#fecaca] border-l-[#e10600]' },
    { label: 'Shipped Orders', bucket: 'shipped', style: 'bg-[#fff5f5] text-slate-800 border-[#fecaca] border-l-[#e10600]' },
    { label: 'Returned', bucket: 'returned', style: 'bg-[#b80505] text-white border-[#b80505]' },
    { label: 'Delivered', bucket: 'delivered', style: 'bg-[#fee2e2] text-slate-900 border-[#fecaca] border-l-[#b80505]' },
  ];

  return <main className="space-y-6 pb-8">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-800 sm:text-[28px]">{greetingForHour(now.getHours())}{firstName ? `, ${firstName}` : ''}</h1>
        <p className="mt-1.5 text-sm text-slate-500">A clear view of sales and lead conversion.</p>
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><CalendarIcon className="h-4 w-4 text-[#e10600]" />{format(now, 'EEEE, MMMM d')}</div>
    </header>

    <section aria-label="Order summary" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-7">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 xl:mx-0 xl:flex-col xl:overflow-visible xl:px-0 xl:pb-0" role="group" aria-label="Order summary period">
          {summaryFilters.map((filter) => {
            const isActive = summaryPeriod === filter.value;
            return <button
              key={filter.value}
              type="button"
              onClick={() => setSummaryPeriod(filter.value)}
              aria-pressed={isActive}
              className={`relative shrink-0 rounded-md px-3 py-2 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e10600] focus-visible:ring-offset-1 xl:w-full ${isActive ? 'bg-[#fff5f5] text-[#b80505]' : 'text-slate-400 hover:bg-[#fff5f5] hover:text-slate-700'}`}
            >
              <span className={`absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#e10600] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
              {filter.label}
            </button>;
          })}
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {orderCards.map(({ label, bucket, style }) => {
            const metric = activeOrderSummary[bucket];
            return <article key={bucket} className="min-w-0">
              <h2 className="mb-2 text-sm font-extrabold text-slate-700">{label}</h2>
              <div className={`flex min-h-28 flex-col justify-center rounded-md border border-l-4 px-4 py-4 shadow-sm ${style}`}>
                <p className="whitespace-nowrap text-lg font-medium leading-none tracking-tight tabular-nums 2xl:text-xl">
                  {metric.count.toLocaleString('en-LK')} <span aria-hidden="true">|</span> Rs. {metric.total.toLocaleString('en-LK', { maximumFractionDigits: 0 })}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold">
                  <span>Commission</span><span className="whitespace-nowrap tabular-nums"><span aria-hidden="true">|</span> Rs. 0</span>
                </div>
              </div>
            </article>;
          })}
        </div>
      </div>
    </section>

    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div><h2 className="text-base font-bold text-slate-800">Sales performance</h2><p className="mt-0.5 text-xs text-slate-500">Delivered revenue and orders for the selected period.</p></div>
        <div className="flex w-fit rounded-md border border-slate-300 p-0.5" aria-label="Sales date range">
          {([7, 30, 90] as Range[]).map(value => <button key={value} type="button" onClick={() => setRange(value)} aria-pressed={range === value} className={`rounded px-3 py-1.5 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#e10600] ${range === value ? 'bg-[#e10600] text-white' : 'text-slate-500 hover:bg-[#fff5f5]'}`}>{value} days</button>)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
        {[['Delivered sales', money(summary.revenue)], ['Delivered orders', summary.orders.toLocaleString()], ['Average order', money(summary.average)], ['Lead conversion', `${initialData.allTime.conversionRate.toFixed(1)}%`]].map(([label, value]) => <div key={label} className="bg-slate-50 px-4 py-3 sm:px-6"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-lg font-extrabold tabular-nums text-slate-800">{value}</div></div>)}
      </div>
      <div className="h-[310px] px-1 pb-4 pt-6 sm:h-[360px] sm:px-4">
        {summary.orders === 0 ? <div className="flex h-full items-center justify-center px-6 text-center"><div><p className="text-sm font-bold text-slate-700">No delivered sales in this period</p><p className="mt-1 text-xs text-slate-500">Choose a longer range or check back after an order is delivered.</p></div></div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={sales} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <defs><linearGradient id="salesRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e10600" stopOpacity={0.32}/><stop offset="95%" stopColor="#e10600" stopOpacity={0.03}/></linearGradient><linearGradient id="salesOrders" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#334155" stopOpacity={0.2}/><stop offset="95%" stopColor="#334155" stopOpacity={0.02}/></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={28} tickMargin={10} fontSize={11} tick={{ fill: '#64748b' }} tickFormatter={(value) => format(new Date(`${value}T00:00:00`), 'MMM d')} />
          <YAxis yAxisId="revenue" axisLine={false} tickLine={false} width={56} fontSize={11} tick={{ fill: '#64748b' }} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} />
          <YAxis yAxisId="orders" orientation="right" axisLine={false} tickLine={false} width={28} allowDecimals={false} fontSize={11} tick={{ fill: '#64748b' }} />
          <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-md border border-[#fecaca] bg-white px-3 py-2 text-xs shadow-lg"><div className="mb-1.5 font-bold text-slate-700">{format(new Date(`${label}T00:00:00`), 'EEEE, MMM d')}</div><div className="flex min-w-40 justify-between gap-5 text-[#b80505]"><span>Revenue</span><strong>{money(Number(payload.find(p => p.dataKey === 'revenue')?.value ?? 0))}</strong></div><div className="mt-1 flex justify-between gap-5 text-slate-700"><span>Orders</span><strong>{Number(payload.find(p => p.dataKey === 'orders')?.value ?? 0)}</strong></div></div> : null} />
          <Area yAxisId="revenue" dataKey="revenue" name="Revenue" type="monotone" fill="url(#salesRevenue)" stroke="#e10600" strokeWidth={2} />
          <Area yAxisId="orders" dataKey="orders" name="Orders" type="monotone" fill="url(#salesOrders)" stroke="#334155" strokeWidth={2} />
        </AreaChart></ResponsiveContainer>}
      </div>
      <div className="flex items-center justify-center gap-5 border-t border-slate-100 py-3 text-xs font-semibold text-slate-600"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#e10600]" />Revenue</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-slate-700" />Orders</span></div>
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
