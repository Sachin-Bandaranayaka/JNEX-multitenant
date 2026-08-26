// src/app/(superadmin)/superadmin/referral-chart.tsx

'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface ReferralData {
    name: string;
    referrals: number;
}

export function ReferralChart({ data }: { data: ReferralData[] }) {
    return (
        <div className="rounded-md border border-slate-300 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Top tenant referrers</h3>
            <div className="mt-4" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                    {/* Removed layout="vertical" to make it a standard vertical chart */}
                    <BarChart 
                        data={data}
                        margin={{ top: 5, right: 20, left: -10, bottom: 60 }} // Increased bottom margin for angled labels
                    >
                        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                        {/* X-axis now shows the seller names */}
                        <XAxis 
                            type="category" 
                            dataKey="name" 
                            stroke="#64748b" 
                            fontSize={12}
                            angle={-45} // Angle the labels to prevent overlap
                            textAnchor="end"
                            interval={0}
                        />
                        {/* Y-axis now shows the numbers */}
                        <YAxis 
                            type="number" 
                            stroke="#64748b" 
                            fontSize={12}
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(15, 23, 42, 0.05)' }}
                            contentStyle={{
                                backgroundColor: '#ffffff',
                                borderColor: '#cbd5e1',
                                borderRadius: 6,
                                color: '#0f172a',
                            }}
                        />
                        <Bar dataKey="referrals" name="Referred Sellers" fill="#e10600" barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}