import { cva, type VariantProps } from 'class-variance-authority';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap font-medium leading-none [&_svg]:size-3.5',
  {
    variants: {
      tone: {
        neutral: 'bg-muted-bg text-ink-700',
        brand: 'bg-brand-50 text-brand-500',
        success: 'bg-success-50 text-success-600',
        danger: 'bg-danger-50 text-danger-600',
        warning: 'bg-warning-50 text-warning-600',
        purple: 'bg-purple-50 text-purple-600',
        teal: 'bg-teal-50 text-teal-500',
        dark: 'bg-ink-900 text-white',
        outline: 'border border-line bg-surface text-ink-700',
      },
      shape: { pill: 'rounded-full', tag: 'rounded-md' },
      size: { sm: 'h-5 px-1.5 text-[11px]', md: 'h-6 px-2 text-xs', lg: 'h-7 px-2.5 text-[13px]' },
    },
    defaultVariants: { tone: 'neutral', shape: 'pill', size: 'md' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, shape, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, shape, size }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * The ▲ 15.5% / ▼ 10.5% pill next to big numbers (DESIGN-SPEC "Delta pill": rounded-md, 12px).
 * `colour` comes from the API when available (engine flags 'blue' | 'red' | 'grey') — never recompute it.
 * Without `colour`, up = green, down = red (or reversed with `invert` for "lower is better" values).
 */
export function DeltaPill({
  value,
  arrow,
  colour,
  invert,
  decimals = 1,
  suffix,
  className,
}: {
  value: number | null | undefined;
  arrow?: 'up' | 'down' | null;
  colour?: 'blue' | 'red' | 'grey' | 'green' | null;
  invert?: boolean;
  decimals?: number;
  suffix?: ReactNode;
  className?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const dir = arrow ?? (value > 0 ? 'up' : value < 0 ? 'down' : null);
  const good = dir === null ? null : (dir === 'up') !== !!invert;
  const tone =
    colour === 'red'
      ? 'danger'
      : colour === 'grey'
        ? 'neutral'
        : colour === 'blue'
          ? 'brand'
          : colour === 'green'
            ? 'success'
            : good === null
              ? 'neutral'
              : good
                ? 'success'
                : 'danger';
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  return (
    <Badge tone={tone} shape="tag" size="md" className={cn('tabular gap-1 px-1.5', className)}>
      <Icon className="size-3.5" strokeWidth={2.25} />
      {fmtPct(Math.abs(value), decimals)}
      {suffix}
    </Badge>
  );
}

type Tone = NonNullable<BadgeProps['tone']>;
const STATUS: Record<string, { label: string; tone: Tone }> = {
  // account / lifecycle states (TRD §7.6)
  active: { label: 'Active', tone: 'success' },
  grace: { label: 'Grace period', tone: 'warning' },
  read_only: { label: 'Read-only', tone: 'warning' },
  expired: { label: 'Expired', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'danger' },
  terminated: { label: 'Terminated', tone: 'neutral' },
  scheduled_for_deletion: { label: 'Deletion scheduled', tone: 'danger' },
  deleted: { label: 'Deleted', tone: 'neutral' },
  // plant setup
  settings_pending: { label: 'Setup pending', tone: 'purple' },
  live: { label: 'Live', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
  // users
  invited: { label: 'Invited', tone: 'brand' },
  disabled: { label: 'Disabled', tone: 'neutral' },
  // invoices
  draft: { label: 'Draft', tone: 'neutral' },
  issued: { label: 'Issued', tone: 'brand' },
  partially_paid: { label: 'Partly paid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  overdue: { label: 'Overdue', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  written_off: { label: 'Written off', tone: 'neutral' },
  // payments
  pending_clearance: { label: 'Cheque pending', tone: 'warning' },
  applied: { label: 'Applied', tone: 'success' },
  bounced: { label: 'Bounced', tone: 'danger' },
  reversed: { label: 'Reversed', tone: 'neutral' },
  // subscriptions
  scheduled: { label: 'Scheduled', tone: 'brand' },
  ended: { label: 'Ended', tone: 'neutral' },
  // logsheets
  submitted: { label: 'Submitted', tone: 'success' },
  corrected: { label: 'Corrected', tone: 'teal' },
  returned: { label: 'Returned', tone: 'danger' },
  checked: { label: 'Checked', tone: 'brand' },
  verified: { label: 'Verified', tone: 'purple' },
  missing: { label: 'Missing', tone: 'danger' },
  // pdfs
  current: { label: 'Current', tone: 'success' },
  superseded: { label: 'Superseded', tone: 'neutral' },
  stale: { label: 'Out of date', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  // generic
  pending: { label: 'Pending', tone: 'warning' },
  running: { label: 'Running', tone: 'brand' },
  done: { label: 'Done', tone: 'success' },
};

/** One mapping for every status chip in the app, so the same state always has the same colour. */
export function StatusBadge({
  status,
  label,
  size = 'md',
  className,
}: {
  status: string | null | undefined;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (!status) return null;
  const s = STATUS[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' as Tone };
  return (
    <Badge tone={s.tone} size={size} dot className={className}>
      {label ?? s.label}
    </Badge>
  );
}
