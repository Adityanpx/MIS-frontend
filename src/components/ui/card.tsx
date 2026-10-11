'use client';

import { MoreHorizontal } from 'lucide-react';
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown';

/** White card, 20px radius, 1px #E8E9EE border, 24px padding, almost-invisible shadow (DESIGN-SPEC §3). */
export const Card = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { padded?: boolean; interactive?: boolean }
>(function Card({ className, padded = true, interactive, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-card border-line bg-surface shadow-card relative border',
        padded && 'p-5 sm:p-6',
        interactive &&
          'hover:border-ink-200 hover:shadow-float cursor-pointer transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  );
});

/** Nested panel inside a card ("Customers" box in the video): one more border, 14px radius. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-inner border-line bg-surface border p-4', className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className="bg-brand-50 text-brand-500 grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-ink-900 truncate text-base font-semibold">{title}</h3>
          {subtitle && <p className="text-ink-500 mt-0.5 truncate text-xs">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export interface CardMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

/** The grey "⋯" at a card's top-right with a small menu (export, open report, …). */
export function CardMenu({ items, label = 'More actions' }: { items: CardMenuItem[]; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="text-ink-400 hover:bg-muted-bg hover:text-ink-900 grid size-8 place-items-center rounded-full transition-colors"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((i) => (
          <DropdownMenuItem key={i.label} onSelect={i.onSelect} disabled={i.disabled} danger={i.danger}>
            {i.icon}
            {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
