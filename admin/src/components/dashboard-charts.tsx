import React from 'react';
import { type DailyMetric } from '@/hooks/use-chart-data';

// ---------------------------------------------------------------------------
// Lightweight SVG charts — zero dependencies, Tailwind-styled
// ---------------------------------------------------------------------------

function MiniBarChart({
  data,
  valueKey,
  label,
  color = '#123F34',
  format,
}: {
  data: DailyMetric[];
  valueKey: 'count' | 'revenue' | 'signups';
  label: string;
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const barWidth = Math.max(2, Math.floor(400 / data.length) - 1);

  return (
    <div className="rounded-xl bg-card border border-card-border p-5 shadow-sm">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">{label}</h3>
      <div className="flex items-end gap-[1px] h-32">
        {data.map((d, i) => {
          const h = Math.max(1, (d[valueKey] / max) * 100);
          return (
            <div key={i} className="group relative flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full rounded-t transition-all duration-200 group-hover:opacity-80"
                style={{
                  height: `${h}%`,
                  backgroundColor: color,
                  minWidth: `${barWidth}px`,
                }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {format ? format(d[valueKey]) : d[valueKey]}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
        <span>{data[0]?.date.slice(5)}</span>
        <span>{data[data.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  color = 'text-primary',
}: {
  title: string;
  value: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-card-border p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className={`text-2xl font-mono font-bold mt-1 ${color}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function DashboardCharts({ data }: { data: DailyMetric[] }) {
  if (!data.length) return null;

  const totalOrders = data.reduce((s, d) => s + d.count, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalSignups = data.reduce((s, d) => s + d.signups, 0);
  const avgDaily = (totalOrders / data.length).toFixed(1);

  const fmtP = (n: number) => 'P' + n.toLocaleString('en-BW', { minimumFractionDigits: 0 });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-xl font-mono font-bold text-foreground">30-Day Analytics</h2>
        <p className="text-sm text-muted-foreground mt-1">Trends across the RunWise network.</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard title="Total Orders (30d)" value={String(totalOrders)} subtitle={`${avgDaily}/day avg`} />
        <SummaryCard title="Revenue (30d)" value={fmtP(totalRevenue)} color="text-emerald-600" />
        <SummaryCard title="New Users (30d)" value={String(totalSignups)} color="text-blue-600" />
        <SummaryCard
          title="Avg Revenue/Order"
          value={totalOrders > 0 ? fmtP(totalRevenue / totalOrders) : '—'}
          color="text-amber-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MiniBarChart data={data} valueKey="count" label="Orders per day" color="#123F34" />
        <MiniBarChart data={data} valueKey="revenue" label="Revenue per day (P)" color="#C9A34A" format={fmtP} />
        <MiniBarChart data={data} valueKey="signups" label="User signups per day" color="#3b82f6" />
      </div>
    </div>
  );
}
