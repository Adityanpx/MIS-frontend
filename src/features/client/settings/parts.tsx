'use client';

import { Eye, History } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { DateField } from '@/components/date/date-field';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { todayIST } from '@/lib/dates';
import { DASH, fmtAuto, fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePlant } from '../plant-context';
import type { ParameterDto, StandardRow } from './types';

/** Settings writes are Client Admin only, and never while the account is read-only. */
export function useCanEditSettings() {
  const { can, readOnly } = usePlant();
  return can('settings.edit') && !readOnly;
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const canEdit = useCanEditSettings();
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-ink-900 text-xl font-semibold tracking-tight">{title}</h2>
          {!canEdit && (
            <Badge tone="neutral" size="sm">
              <Eye /> View only
            </Badge>
          )}
        </div>
        {description && <p className="text-ink-500 mt-1 max-w-2xl text-sm">{description}</p>}
      </div>
      {actions && canEdit && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-60" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="rounded-card h-40" />
      ))}
    </div>
  );
}

/** A labelled read-only value (plant facts, derived money). */
export function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-ink-400 text-[11px] font-medium tracking-wider uppercase">{label}</p>
      <div className="text-ink-900 tabular mt-1 truncate text-sm font-semibold">{children ?? DASH}</div>
    </div>
  );
}

/** Switch row: label + description on the left, control on the right. */
export function ToggleRow({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="rounded-inner border-line flex items-center justify-between gap-4 border p-4">
      <div className="min-w-0">
        <p className="text-ink-900 text-sm font-semibold">{title}</p>
        {description && <p className="text-ink-500 mt-0.5 text-xs">{description}</p>}
      </div>
      {control}
    </div>
  );
}

export interface EffectiveValue {
  effectiveFrom: string | null;
  reason: string;
}
export const EFFECTIVE_TODAY: EffectiveValue = { effectiveFrom: null, reason: '' };

/** CHG-01/02: "from which date?" — today by default; a past date recalculates history and needs a reason. */
export function EffectiveFields({
  value,
  onChange,
  errors,
  label = 'Effective from',
}: {
  value: EffectiveValue;
  onChange: (v: EffectiveValue) => void;
  errors?: Record<string, string>;
  label?: string;
}) {
  const { plant } = usePlant();
  const today = todayIST();
  const from = value.effectiveFrom ?? today;
  const backdated = from < today;
  return (
    <div className="space-y-4">
      <Field
        label={label}
        hint={backdated ? 'Backdated: reports from this date are recalculated.' : 'Today unless you pick another date.'}
        error={errors?.effectiveFrom}
      >
        <DateField
          value={from}
          onChange={(d) => onChange({ ...value, effectiveFrom: d })}
          min={plant.omStart}
          max={plant.omEnd}
        />
      </Field>
      <motion.div initial={false} animate={{ opacity: backdated ? 1 : 0.6 }}>
        <Field
          label="Reason"
          required={backdated}
          error={errors?.reason}
          hint={backdated ? 'Required for a backdated change — kept in the audit log.' : 'Optional.'}
        >
          <Textarea rows={2} value={value.reason} onChange={(e) => onChange({ ...value, reason: e.target.value })} />
        </Field>
      </motion.div>
    </div>
  );
}
/** Body fields for an effective-dated request. */
export const effectiveBody = (v: EffectiveValue) => ({
  effectiveFrom: v.effectiveFrom ?? undefined,
  reason: v.reason.trim() || undefined,
});
/** Client-side twin of the API's REASON_REQUIRED rule. */
export function effectiveErrors(v: EffectiveValue): Record<string, string> {
  const from = v.effectiveFrom ?? todayIST();
  return from < todayIST() && !v.reason.trim() ? { reason: 'A reason is required for a backdated change' } : {};
}

/** Timeline of effective-dated values (standards, strengths, constants). */
export function HistoryList<T extends { effectiveFrom: string; reason: string | null }>({
  rows,
  render,
}: {
  rows: T[];
  render: (r: T) => ReactNode;
}) {
  const today = todayIST();
  const sorted = [...rows].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const currentIdx = sorted.findIndex((r) => r.effectiveFrom <= today);
  return (
    <ol className="border-line relative ml-2 space-y-4 border-l pl-5">
      {sorted.map((r, i) => (
        <li key={`${r.effectiveFrom}-${i}`} className="relative">
          <span
            className={cn(
              'ring-surface absolute top-1 -left-[26px] size-2.5 rounded-full ring-4',
              i === currentIdx ? 'bg-brand-500' : r.effectiveFrom > today ? 'bg-purple-500' : 'bg-ink-300',
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-900 tabular text-[13px] font-semibold">from {fmtDate(r.effectiveFrom)}</span>
            {i === currentIdx && (
              <Badge tone="brand" size="sm">
                Current
              </Badge>
            )}
            {r.effectiveFrom > today && (
              <Badge tone="purple" size="sm">
                Scheduled
              </Badge>
            )}
          </div>
          <div className="text-ink-700 mt-0.5 text-[13px]">{render(r)}</div>
          {r.reason && (
            <p className="text-ink-500 mt-0.5 flex items-center gap-1 text-xs italic">
              <History className="size-3" /> {r.reason}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

/** The value valid today of an effective-dated list (or the earliest if all are in the future). */
export function currentOf<T extends { effectiveFrom: string }>(rows: T[]): T | undefined {
  const today = todayIST();
  const past = rows
    .filter((r) => r.effectiveFrom <= today)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return past[0] ?? [...rows].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
}

export function PanelCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn('p-5 sm:p-6', className)}>{children}</Card>;
}

/** "" → undefined, "12" → 12, "abc" → NaN (the zod schema reports it). */
export const numOrUndef = (s: string): number | undefined =>
  s.trim() === '' ? undefined : Number(s.replace(/,/g, ''));
export const numOrNull = (s: string): number | null => (s.trim() === '' ? null : Number(s.replace(/,/g, '')));
export const str = (v: number | string | null | undefined) => (v === null || v === undefined ? '' : String(v));

/** "120 / day" · "6 – 8.5" · "≤ 10" · "8 / day · 32 / month" */
export function standardText(p: Pick<ParameterDto, 'stdType' | 'unit'>, s: StandardRow | undefined): string {
  if (!s) return DASH;
  const parts: string[] = [];
  if (s.std !== null) parts.push(`${fmtAuto(s.std, 2)}${p.stdType === 'range' ? '' : ' / day'}`);
  if (s.monthly !== null) parts.push(`${fmtAuto(s.monthly, 2)} / month`);
  if (s.min !== null && s.max !== null) parts.push(`${fmtAuto(s.min, 2)} – ${fmtAuto(s.max, 2)}`);
  else if (s.max !== null) parts.push(`≤ ${fmtAuto(s.max, 2)}`);
  else if (s.min !== null) parts.push(`≥ ${fmtAuto(s.min, 2)}`);
  return parts.join(' · ') || DASH;
}
