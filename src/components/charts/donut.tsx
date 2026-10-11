'use client';

import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { fmtNum, fmtPct } from '@/lib/format';
import { ChartTooltip } from './chart-tooltip';
import { SERIES_COLOURS } from './theme';

export interface DonutDatum {
  label: string;
  value: number;
  color?: string;
}

/** Donut with a centre value and a legend (the "Visitors by Device" widget). */
export function Donut({
  data,
  centre,
  centreLabel,
  size = 180,
  format = (v) => fmtNum(v, 0),
  legend = true,
}: {
  data: DonutDatum[];
  centre?: ReactNode;
  centreLabel?: ReactNode;
  size?: number;
  format?: (v: number) => string;
  legend?: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const rows = data.map((d, i) => ({ ...d, color: d.color ?? SERIES_COLOURS[i % SERIES_COLOURS.length] ?? '#2B61F9' }));
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={(p) => (
                <ChartTooltip
                  active={p.active}
                  payload={p.payload}
                  label={p.label}
                  rows={[
                    {
                      key: 'value',
                      label: '',
                      color: (p.payload?.[0]?.payload as { color?: string } | undefined)?.color ?? '#2B61F9',
                    },
                  ]}
                  format={(v) => `${format(v)} · ${fmtPct((v / total) * 100)}`}
                  title={(_, row) => String(row.label ?? '')}
                />
              )}
            />
            <Pie
              data={rows}
              dataKey="value"
              nameKey="label"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={2}
              cornerRadius={6}
              stroke="none"
              animationDuration={900}
            >
              {rows.map((r) => (
                <Cell key={r.label} fill={r.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {(centre || centreLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centre && <span className="text-ink-900 tabular text-2xl font-semibold">{centre}</span>}
            {centreLabel && <span className="text-ink-500 text-xs">{centreLabel}</span>}
          </div>
        )}
      </div>
      {legend && (
        <ul className="w-full min-w-0 space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2.5 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
              <span className="text-ink-700 min-w-0 flex-1 truncate">{r.label}</span>
              <span className="text-ink-900 tabular font-semibold">{format(r.value)}</span>
              <span className="text-ink-500 tabular w-12 text-right text-xs">{fmtPct((r.value / total) * 100, 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
