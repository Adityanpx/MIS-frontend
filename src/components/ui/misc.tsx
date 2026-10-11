'use client';

import * as Cb from '@radix-ui/react-checkbox';
import * as Sw from '@radix-ui/react-switch';
import { Check, Copy, Inbox, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { toast } from 'sonner';
import { cn, initials } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton rounded-lg', className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('text-brand-500 size-5 animate-spin', className)} aria-label="Loading" />;
}

/** ⌘K keycap */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'border-line bg-surface text-ink-500 inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 font-sans text-[11px] font-medium shadow-[0_1px_0_var(--color-line)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

const AVATAR_GRADIENTS = [
  'from-brand-400 to-brand-600',
  'from-purple-500 to-brand-500',
  'from-teal-500 to-brand-500',
  'from-warning-500 to-danger-500',
  'from-success-400 to-teal-500',
];
/** 40px round avatar with initials on a gradient (stable colour per name). */
export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const g = AVATAR_GRADIENTS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length];
  return (
    <span
      className={cn(
        'ring-surface relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-linear-to-br font-semibold text-white ring-2',
        g,
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed R2 URLs change; next/image would need remotePatterns per bucket
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 py-8' : 'gap-3 py-14',
        className,
      )}
    >
      <div className="relative">
        <div className="dot-grid-ink absolute -inset-6 rounded-full [mask-image:radial-gradient(circle,black,transparent_70%)] opacity-70" />
        <span className="border-line bg-surface text-brand-500 shadow-card relative grid size-14 place-items-center rounded-2xl border [&_svg]:size-6">
          {icon ?? <Inbox />}
        </span>
      </div>
      <div>
        <p className="text-ink-900 text-[15px] font-semibold">{title}</p>
        {description && <p className="text-ink-500 mx-auto mt-1 max-w-sm text-sm">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <Sw.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className="bg-ink-200 data-[state=checked]:bg-brand-500 relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50"
    >
      <Sw.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgb(16_24_40/0.2)] transition-transform duration-200 data-[state=checked]:translate-x-[22px]" />
    </Sw.Root>
  );
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean | 'indeterminate';
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  return (
    <Cb.Root
      id={id}
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="border-ink-300 bg-surface data-[state=checked]:border-brand-500 data-[state=checked]:bg-brand-500 data-[state=indeterminate]:border-brand-500 data-[state=indeterminate]:bg-brand-500 grid size-5 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-50"
    >
      <Cb.Indicator>
        {checked === 'indeterminate' ? (
          <span className="block h-0.5 w-2.5 rounded bg-white" />
        ) : (
          <Check className="size-3.5 text-white" strokeWidth={3} />
        )}
      </Cb.Indicator>
    </Cb.Root>
  );
}

export function CopyButton({
  value,
  label = 'Copy',
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={cn(
        'border-line bg-surface text-ink-700 hover:bg-canvas inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
        className,
      )}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error('Could not copy. Select the text and copy it manually.');
        }
      }}
    >
      {done ? <Check className="text-success-600 size-3.5" /> : <Copy className="size-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

/** Thin progress bar with an animated fill (usage vs limit, completion, compliance). */
export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  className,
  height = 8,
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'auto';
  className?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const t = tone === 'auto' ? (pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'brand') : tone;
  const colours = {
    brand: 'bg-brand-500',
    success: 'bg-success-400',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
  } as const;
  return (
    <div className={cn('bg-muted-bg w-full overflow-hidden rounded-full', className)} style={{ height }}>
      <motion.div
        className={cn('h-full rounded-full', colours[t])}
        initial={{ width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}
