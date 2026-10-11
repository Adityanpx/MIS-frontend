'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/shell/logo';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

/** First paint while the refresh cookie is being checked: a ghost of the shell, so nothing jumps. */
export function ShellSkeleton() {
  return (
    <div className="bg-canvas flex min-h-dvh" aria-busy="true" aria-label="Loading">
      <div className="border-line bg-surface hidden w-64 shrink-0 border-r p-6 lg:block">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="mt-10 space-y-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex-1">
        <div className="border-line bg-surface flex h-[72px] items-center gap-4 border-b px-8">
          <Skeleton className="h-10 w-80 rounded-full" />
          <div className="ml-auto flex gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="size-10 rounded-full" />
          </div>
        </div>
        <div className="p-8">
          <Skeleton className="h-8 w-56" />
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="rounded-card h-[132px]" />
            ))}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <Skeleton className="rounded-card h-80" />
            <Skeleton className="rounded-card h-80" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Small centered loader (gates, act-as exchange). */
export function CenterLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="bg-canvas grid min-h-dvh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        >
          <LogoMark size={44} />
        </motion.div>
        <p className="text-ink-500 text-sm">{label}</p>
      </div>
    </div>
  );
}

/** Full-page message (suspended, terminated, act-as ended, plant not found). */
export function StateScreen({
  icon,
  tone = 'brand',
  title,
  children,
  actions,
  className,
}: {
  icon: ReactNode;
  tone?: 'brand' | 'danger' | 'warning' | 'purple';
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const wells = {
    brand: 'bg-brand-50 text-brand-500',
    danger: 'bg-danger-50 text-danger-500',
    warning: 'bg-warning-50 text-warning-500',
    purple: 'bg-purple-50 text-purple-500',
  } as const;
  return (
    <div className={cn('bg-canvas grid min-h-dvh place-items-center p-4', className)}>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="border-line bg-surface shadow-card w-full max-w-md rounded-3xl border p-8 text-center"
      >
        <span className={cn('mx-auto grid size-14 place-items-center rounded-2xl [&_svg]:size-7', wells[tone])}>
          {icon}
        </span>
        <h1 className="text-ink-900 mt-5 text-xl font-semibold tracking-tight">{title}</h1>
        {children && <div className="text-ink-500 mt-2 text-sm leading-relaxed">{children}</div>}
        {actions && <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">{actions}</div>}
      </motion.div>
    </div>
  );
}
