// src/app/(superadmin)/superadmin/chart-card.tsx

'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function ChartCard({ data }: { data: any[] }) {
  return (
    <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">Tenant status</h3>
      <div className="mt-4" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(15, 23, 42, 0.05)' }}
              contentStyle={{
                backgroundColor: '#ffffff',
                borderColor: '#cbd5e1',
                borderRadius: 6,
                color: '#0f172a',
              }}
            />
            <Bar dataKey="value" barSize={60}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}