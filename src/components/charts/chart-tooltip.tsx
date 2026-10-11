'use client';

import type { ReactNode } from 'react';

export interface TooltipRow {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

/**
 * The white tooltip from the video: rounded-lg, border, soft shadow; title (date) then one row per series
 * with a solid or dashed swatch — "₹12,324  this month" / "₹5,563  last month".
 */
export function ChartTooltip({
  active,
  payload,
  label,
  rows,
  format,
  title,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
  label?: string | number;
  rows: TooltipRow[];
  format: (v: number, key: string) => string;
  title?: (label: string | number, row: Record<string, unknown>) => ReactNode;
}) {
  if (!active || !payload?.length) return null;
  const row = (payload[0]?.payload ?? {}) as Record<string, unknown>;
  return (
    <div className="border-line bg-surface shadow-float min-w-[180px] rounded-xl border px-3.5 py-3">
      <p className="text-ink-500 mb-2 text-xs font-medium">{title ? title(label ?? '', row) : String(label ?? '')}</p>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const v = row[r.key];
          if (typeof v !== 'number') return null;
          return (
            <div key={r.key} className="flex items-center gap-2.5 text-[13px]">
              <svg width="18" height="4" className="shrink-0" aria-hidden>
                <line
                  x1="1"
                  y1="2"
                  x2="17"
                  y2="2"
                  stroke={r.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={r.dashed ? '3 3' : undefined}
                />
              </svg>
              <span className="text-ink-900 tabular font-semibold">{format(v, r.key)}</span>
              <span className="text-ink-500">{r.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
