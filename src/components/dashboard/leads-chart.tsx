'use client';

import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';

interface LeadsChartProps { data: Array<{ status: string; count: number }> }
const COLORS: Record<string, string> = { CONFIRMED: '#e10600', PENDING: '#f0443e', NO_ANSWER: '#fb7773', REJECTED: '#b80505', CANCELLED: '#64748b', DUPLICATE: '#334155' };
const formatStatus = (status: string) => status.toLowerCase().split('_').map(word => word[0]?.toUpperCase() + word.slice(1)).join(' ');

export function LeadsChart({ data }: LeadsChartProps) {
  const defaultIndex = useMemo(() => {
    const confirmed = data.findIndex(item => item.status.toUpperCase() === 'CONFIRMED');
    if (confirmed >= 0) return confirmed;
    return data.reduce((largest, item, index) => item.count > (data[largest]?.count ?? -1) ? index : largest, 0);
  }, [data]);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const activeIndex = selectedStatus ? Math.max(0, data.findIndex(item => item.status === selectedStatus)) : defaultIndex;
  const active = data[activeIndex];
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (!data.length) return <div className="flex h-[290px] items-center justify-center text-center"><div><p className="text-sm font-bold text-slate-700">No lead data yet</p><p className="mt-1 text-xs text-slate-500">Lead outcomes will appear here.</p></div></div>;

  return <div>
    <div className="relative mx-auto h-[230px] max-w-[330px]">
      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={62} outerRadius={82} paddingAngle={2} stroke="#fff" strokeWidth={3} activeIndex={activeIndex} activeShape={(props: any) => <Sector {...props} outerRadius={(props.outerRadius ?? 82) + 9} />} onClick={(_, index) => setSelectedStatus(data[index]?.status ?? null)}>{data.map(item => <Cell key={item.status} fill={COLORS[item.status.toUpperCase()] ?? '#94a3b8'} className="cursor-pointer outline-none" />)}</Pie><Tooltip cursor={false} formatter={(value: number, name: string) => [Number(value).toLocaleString(), formatStatus(name)]} contentStyle={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12 }} /></PieChart></ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-extrabold tabular-nums text-slate-800">{(active?.count ?? total).toLocaleString()}</span><span className="mt-0.5 max-w-24 text-center text-[11px] font-semibold text-slate-500">{active ? formatStatus(active.status) : 'Total leads'}</span></div>
    </div>
    <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-x-4 gap-y-2 pt-2">{data.map((item, index) => <button type="button" key={item.status} onClick={() => setSelectedStatus(item.status)} className={`flex items-center gap-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e10600] ${index === activeIndex ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[item.status.toUpperCase()] ?? '#94a3b8' }} />{formatStatus(item.status)} <span className="tabular-nums">{item.count}</span></button>)}</div>
  </div>;
}
