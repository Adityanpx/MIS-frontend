'use client';

import type { ReactNode } from 'react';
import { CountUp } from '@/components/motion/count-up';
import { Sparkline } from '@/components/charts/sparkline';
import { DeltaPill } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface StatDelta {
  value: number | null;
  arrow?: 'up' | 'down' | null;
  colour?: 'blue' | 'red' | 'grey' | 'green' | null;
  invert?: boolean;
}

/**
 * The 4 KPI cards of row 1 ("Page Views 16.431 ▲15.5% vs. 14,653 last period").
 * Title left + small brand icon top-right, big animated value + delta pill, grey caption, optional sparkline.
 */
export function StatCard({
  title,
  icon,
  value,
  format = (n) => fmtNum(n, 0),
  unit,
  delta,
  caption,
  spark,
  onClick,
  loading,
  footer,
  className,
  iconTone = 'brand',
}: {
  title: ReactNode;
  icon?: ReactNode;
  value: number | null | undefined;
  format?: (n: number) => string;
  unit?: string | null;
  delta?: StatDelta;
  caption?: ReactNode;
  spark?: Array<number | null>;
  onClick?: () => void;
  loading?: boolean;
  footer?: ReactNode;
  className?: string;
  iconTone?: 'brand' | 'success' | 'warning' | 'danger' | 'purple';
}) {
  const iconColour = {
    brand: 'text-brand-500',
    success: 'text-success-600',
    warning: 'text-warning-500',
    danger: 'text-danger-500',
    purple: 'text-purple-500',
  }[iconTone];
  return (
    <Card interactive={!!onClick} onClick={onClick} className={cn('flex h-full min-h-[132px] flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-700 truncate text-sm font-medium">{title}</p>
        {icon && <span className={cn('shrink-0 [&_svg]:size-[18px]', iconColour)}>{icon}</span>}
      </div>
      {loading ? (
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="text-ink-900 text-[28px] leading-none font-semibold tracking-tight">
              <CountUp value={value} format={format} />
            </span>
            {unit && <span className="text-ink-500 text-sm font-medium">{unit}</span>}
            {delta && <DeltaPill {...delta} />}
          </div>
          {caption && <p className="text-ink-500 mt-2.5 truncate text-xs">{caption}</p>}
          {spark && spark.length > 1 && (
            <div className="-mx-1 mt-auto pt-3">
              <Sparkline values={spark} height={36} />
            </div>
          )}
          {footer && <div className="mt-auto pt-3">{footer}</div>}
        </>
      )}
    </Card>
  );
}
