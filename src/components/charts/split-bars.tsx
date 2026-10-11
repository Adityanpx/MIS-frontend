'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { CountUp } from '@/components/motion/count-up';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';

type SplitTone = 'blue' | 'green' | 'orange' | 'purple' | 'red';
const TONES: Record<SplitTone, { rule: string; bar: string; bg: string; text: string }> = {
  blue: { rule: 'border-brand-500', bar: 'bg-brand-500', bg: 'stat-blue', text: 'text-brand-500' },
  green: { rule: 'border-success-400', bar: 'bg-success-400', bg: 'stat-green', text: 'text-success-600' },
  orange: { rule: 'border-warning-500', bar: 'bg-warning-500', bg: 'stat-orange', text: 'text-warning-500' },
  purple: { rule: 'border-purple-500', bar: 'bg-purple-500', bg: 'stat-purple', text: 'text-purple-500' },
  red: { rule: 'border-danger-500', bar: 'bg-danger-500', bg: 'stat-red', text: 'text-danger-500' },
};

export interface SplitItem {
  label: string;
  value: number | null;
  tone: SplitTone;
  icon?: ReactNode;
  format?: (v: number) => string;
}

/**
 * The "Customers" split panel: columns sized by value, each with a 2px coloured left rule, icon, value,
 * grey label and a thick rounded bar along the bottom, colour fading upward from the bar.
 * OMMIS: revenue split (fixed fee / energy / other), power split (EB / DG / BGE), staff by category…
 */
export function SplitBars({ items, className }: { items: SplitItem[]; className?: string }) {
  const total = items.reduce((s, i) => s + Math.max(0, i.value ?? 0), 0) || 1;
  return (
    <div className={cn('flex w-full gap-1.5', className)}>
      {items.map((it, i) => {
        const t = TONES[it.tone];
        const share = Math.max(0, it.value ?? 0) / total;
        return (
          <div
            key={it.label}
            className={cn('relative flex min-w-[84px] flex-col justify-between overflow-hidden', t.bg)}
            style={{ flexGrow: Math.max(share, 0.18), flexBasis: 0 }}
          >
            <div className={cn('border-l-2 pb-4 pl-3', t.rule)}>
              <div className="flex items-center gap-2">
                {it.icon && <span className={cn('[&_svg]:size-4', t.text)}>{it.icon}</span>}
                <span className="text-ink-900 text-lg font-semibold sm:text-xl">
                  <CountUp value={it.value} format={it.format ?? ((n) => fmtNum(n, 0))} />
                </span>
              </div>
              <p className="text-ink-500 mt-1 truncate text-xs">{it.label}</p>
            </div>
            <motion.div
              className={cn('h-2 w-full origin-left rounded-full', t.bar)}
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        );
      })}
    </div>
  );
}
