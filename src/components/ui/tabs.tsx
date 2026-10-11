'use client';

import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<V extends string> {
  value: V;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

/**
 * Pill segmented control with a sliding white thumb (Today / MTD / UTD, chart ranges, report modes).
 * Purely controlled; keyboard: Tab to focus, ←/→ to move.
 */
export function Segmented<V extends string>({
  items,
  value,
  onChange,
  size = 'md',
  className,
  block,
}: {
  items: TabItem<V>[];
  value: V;
  onChange: (v: V) => void;
  size?: 'sm' | 'md';
  className?: string;
  block?: boolean;
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn('bg-muted-bg relative inline-flex rounded-full p-1', block && 'flex w-full', className)}
      onKeyDown={(e) => {
        const i = items.findIndex((x) => x.value === value);
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        const next = items[(i + step + items.length) % items.length];
        if (next && !next.disabled) onChange(next.value);
      }}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={it.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors disabled:opacity-40',
              size === 'md' ? 'h-8 px-4 text-[13px]' : 'h-7 px-3 text-xs',
              block && 'flex-1',
              active ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="bg-surface absolute inset-0 -z-10 rounded-full shadow-[0_1px_3px_rgb(16_24_40/0.10)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            {it.label}
            {it.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-full px-1.5 text-[11px]',
                  active ? 'bg-brand-50 text-brand-500' : 'bg-surface text-ink-500',
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Underlined page tabs (settings sections, client detail tabs) with a sliding blue underline. */
export function Tabs<V extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<V>[];
  value: V;
  onChange: (v: V) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn('scrollbar-none border-line flex gap-1 overflow-x-auto border-b', className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={it.disabled}
            onClick={() => onChange(it.value)}
            className={cn(
              'relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors disabled:opacity-40',
              active ? 'text-brand-500' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-full px-1.5 py-0.5 text-[11px] leading-none',
                  active ? 'bg-brand-50' : 'bg-muted-bg',
                )}
              >
                {it.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                className="bg-brand-500 absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
