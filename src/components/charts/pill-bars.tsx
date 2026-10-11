'use client';

import { motion } from 'motion/react';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/popover';

export interface PillDatum {
  label: string;
  value: number | null;
  hint?: string;
}

/**
 * "Most Day Active": tall rounded pill bars in #F0F1F5; the highlighted one is solid brand blue with its
 * value above it and a blue bold label. Bars grow from the bottom one after another.
 * OMMIS uses it for "last 7 days" (inflow, power, logsheet submissions…).
 */
export function PillBars({
  data,
  height = 168,
  highlight = 'max',
  format = (v) => fmtNum(v, 0),
  onSelect,
  tone = 'brand',
}: {
  data: PillDatum[];
  height?: number;
  highlight?: 'max' | 'last' | number | 'none';
  format?: (v: number) => string;
  onSelect?: (d: PillDatum, i: number) => void;
  tone?: 'brand' | 'success' | 'danger';
}) {
  const vals = data.map((d) => d.value ?? 0);
  const max = Math.max(1, ...vals);
  const hi =
    highlight === 'none'
      ? -1
      : highlight === 'max'
        ? vals.indexOf(Math.max(...vals))
        : highlight === 'last'
          ? data.length - 1
          : highlight;
  const on = {
    brand: 'bg-linear-to-b from-brand-400 to-brand-500',
    success: 'bg-linear-to-b from-success-400 to-success-600',
    danger: 'bg-linear-to-b from-danger-500 to-danger-600',
  }[tone];
  const onText = { brand: 'text-brand-500', success: 'text-success-600', danger: 'text-danger-600' }[tone];

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-2 sm:gap-3" style={{ height }}>
        {data.map((d, i) => {
          const active = i === hi;
          const pct = d.value === null ? 6 : Math.max(8, (d.value / max) * 100);
          return (
            <Tooltip
              key={`${d.label}-${i}`}
              content={d.value === null ? 'No data' : `${d.hint ?? d.label}: ${format(d.value)}`}
            >
              <button
                type="button"
                onClick={onSelect ? () => onSelect(d, i) : undefined}
                className={cn(
                  'group relative flex h-full flex-1 flex-col items-center justify-end focus:outline-none',
                  !onSelect && 'cursor-default',
                )}
                aria-label={`${d.label}: ${d.value === null ? 'no data' : format(d.value)}`}
              >
                {active && d.value !== null && (
                  <motion.span
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className="text-ink-900 tabular mb-1.5 text-[13px] font-semibold"
                  >
                    {format(d.value)}
                  </motion.span>
                )}
                <motion.span
                  className={cn(
                    'block w-full max-w-[44px] rounded-full transition-colors',
                    active ? cn(on, 'shadow-[0_8px_18px_rgb(43_97_249/0.25)]') : 'bg-muted-bg group-hover:bg-ink-200',
                  )}
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  style={{ maxHeight: active ? 'calc(100% - 26px)' : '100%' }}
                />
              </button>
            </Tooltip>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between gap-2 sm:gap-3">
        {data.map((d, i) => (
          <span
            key={`${d.label}-l-${i}`}
            className={cn(
              'flex-1 truncate text-center text-xs',
              i === hi ? cn('font-semibold', onText) : 'text-ink-500',
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
