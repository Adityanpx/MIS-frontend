'use client';

import { AlertCircle, Calculator, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { Tooltip } from '@/components/ui/popover';
import { DASH, fmtAuto, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isText, parseNumber, parseValue, standardState } from './form-engine';
import type { FormField } from './types';

/** "Std 120 MLD/day" · "Limit 6 – 8.5" · "≤ 10 mg/L" · "Required 12" — the standard valid on the date. */
export function standardHint(f: FormField): string | null {
  const s = f.standard;
  if (!s) return null;
  const u = f.unit && f.unit !== 'value' && f.unit !== 'text' ? ` ${f.unit}` : '';
  if (f.eventRule === 'outside_range' || (s.std === null && (s.min !== null || s.max !== null))) {
    if (s.min !== null && s.max !== null) return `Limit ${fmtAuto(s.min)} – ${fmtAuto(s.max)}${u}`;
    if (s.max !== null) return `Limit ≤ ${fmtAuto(s.max)}${u}`;
    if (s.min !== null) return `Limit ≥ ${fmtAuto(s.min)}${u}`;
  }
  if (f.linkRole === 'available' && s.std !== null) return `Required ${fmtAuto(s.std, 0)}`;
  if (s.std !== null) {
    const extra = s.min !== null ? ` · min ${fmtAuto(s.min)}` : '';
    const monthly = s.monthly !== null ? ` · ${fmtAuto(s.monthly)}${u}/month allowed` : '';
    return `Std ${fmtAuto(s.std, 2)}${u}/day${extra}${monthly}`;
  }
  return null;
}

/** Live state chip next to a value: within / outside the standard (soft) — the hard error wins. */
export function ValueState({ field, value }: { field: FormField; value: number | null }) {
  if (value === null || !Number.isFinite(value) || !field.standard) return null;
  const st = standardState(field, value);
  if (st === 'ok') {
    if (field.eventRule === 'none') return null;
    return (
      <span className="text-success-600 inline-flex items-center gap-1 text-[11px] font-medium">
        <span className="bg-success-500 size-1.5 rounded-full" />
        {field.eventRule === 'outside_range' ? 'Within limit' : 'Within standard'}
      </span>
    );
  }
  const label =
    st === 'limit'
      ? 'Outside warning limit'
      : field.eventRule === 'above_std'
        ? 'Above standard'
        : field.eventRule === 'below_std'
          ? 'Below standard'
          : 'Outside limit';
  return (
    <span className="text-warning-600 inline-flex items-center gap-1 text-[11px] font-semibold">
      <span className="bg-warning-500 size-1.5 rounded-full" />
      {label}
    </span>
  );
}

const boxBase =
  'h-11 w-full rounded-control border bg-canvas px-3.5 text-[15px] font-semibold text-ink-900 tabular transition-[border-color,box-shadow,background] duration-150 placeholder:font-normal placeholder:text-ink-300 hover:border-ink-300 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand-500/12';

/** The number / text box. Numbers right-aligned, Indian commas accepted ("1,30,462"). */
export const ValueBox = forwardRef<
  HTMLInputElement,
  {
    field: FormField;
    value: string;
    onChange: (v: string) => void;
    editable: boolean;
    error?: string | null;
    changed?: boolean;
    warn?: boolean;
    className?: string;
    id?: string;
    'aria-label'?: string;
  }
>(function ValueBox({ field, value, onChange, editable, error, changed, warn, className, id, ...rest }, ref) {
  const numeric = !isText(field);
  if (!editable) {
    const v = parseValue(field, value);
    return (
      <div
        className={cn(
          'rounded-control border-line bg-canvas/60 text-ink-900 tabular flex h-11 items-center border border-dashed px-3.5 text-[15px] font-semibold',
          numeric ? 'justify-end' : 'justify-start text-sm font-medium',
          warn && 'text-warning-600',
          className,
        )}
      >
        {v === null ? (
          <span className="text-ink-300 font-normal">{DASH}</span>
        ) : numeric ? (
          fmtNum(Number((v as number).toFixed(6)))
        ) : (
          String(v)
        )}
      </div>
    );
  }
  return (
    <input
      ref={ref}
      id={id}
      type="text"
      inputMode={numeric ? 'decimal' : 'text'}
      autoComplete="off"
      spellCheck={false}
      value={value}
      placeholder={numeric ? '—' : 'Type here'}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={!!error || undefined}
      aria-label={rest['aria-label'] ?? field.name}
      className={cn(
        boxBase,
        numeric ? 'text-right' : 'text-left text-sm font-medium',
        error ? 'border-danger-500 focus:ring-danger-500/12' : 'border-line',
        changed && !error && 'border-brand-400 bg-brand-50/50',
        warn && !error && 'text-warning-600',
        className,
      )}
    />
  );
});

function UnitChip({ unit }: { unit: string }) {
  if (!unit || unit === 'text' || unit === 'value') return null;
  return (
    <span className="bg-muted-bg text-ink-500 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
      {unit}
    </span>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="text-danger-600 flex items-center gap-1 overflow-hidden pt-1 text-xs font-medium"
        >
          <AlertCircle className="size-3.5 shrink-0" />
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** One parameter: label + unit, the value box, the standard hint, live state and errors. */
export function FieldRow({
  field,
  raw,
  onChange,
  editable,
  error,
  calcValue,
  original,
  label,
  extra,
}: {
  field: FormField;
  raw: string;
  onChange: (v: string) => void;
  editable: boolean;
  error?: string | null;
  /** live formula value for calculated / suggested parameters */
  calcValue?: number | null;
  /** stored value (correction mode shows "was …" when it changed) */
  original?: string;
  label?: ReactNode;
  extra?: ReactNode;
}) {
  const parsed = isText(field) ? null : parseNumber(raw);
  const value = typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
  const changed = original !== undefined && (original ?? '') !== (raw ?? '');
  const hint = standardHint(field);
  const warn = value !== null && standardState(field, value) !== 'ok';

  if (field.inputMode === 'calculated') {
    const v = calcValue ?? null;
    return (
      <div className="min-w-0" id={`f-${field.parameterId}`}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-ink-700 truncate text-[13px] font-medium">{label ?? field.name}</span>
          <UnitChip unit={field.unit} />
        </div>
        <Tooltip content={<span>Calculated: {field.formula}</span>}>
          <div className="rounded-control border-brand-200 bg-brand-50/60 flex h-11 items-center justify-between gap-2 border border-dashed px-3.5">
            <span className="text-brand-500 inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase">
              <Calculator className="size-3.5" /> Auto
            </span>
            <span className="text-ink-900 tabular text-[15px] font-semibold">
              {v === null ? <span className="text-ink-300 font-normal">{DASH}</span> : fmtNum(v, field.decimals)}
            </span>
          </div>
        </Tooltip>
        <div className="mt-1 flex min-h-4 items-center justify-between gap-2">
          <span className="text-ink-400 truncate text-[11px]">{hint ?? field.formula}</span>
          <ValueState field={field} value={v} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0" id={`f-${field.parameterId}`}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-ink-700 truncate text-[13px] font-medium" htmlFor={`in-${field.parameterId}`}>
          {label ?? field.name}
          {field.mandatory && !isText(field) && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
        <UnitChip unit={field.unit} />
      </div>
      <ValueBox
        id={`in-${field.parameterId}`}
        field={field}
        value={raw}
        onChange={onChange}
        editable={editable}
        error={error}
        changed={changed}
        warn={warn}
      />
      {field.inputMode === 'suggested' && editable && calcValue !== null && calcValue !== undefined && (
        <button
          type="button"
          onClick={() => onChange(String(Number(calcValue.toFixed(field.decimals))))}
          className="text-brand-500 hover:text-brand-600 mt-1 inline-flex items-center gap-1 text-[11px] font-semibold"
        >
          <Sparkles className="size-3" /> Use suggested {fmtNum(calcValue, field.decimals)}
        </button>
      )}
      <FieldError message={error} />
      {!error && (
        <div className="mt-1 flex min-h-4 items-center justify-between gap-2">
          <span className="text-ink-400 truncate text-[11px]">
            {changed ? (
              <span className="text-brand-500 font-medium">
                was {original === '' || original === undefined ? DASH : original}
              </span>
            ) : (
              hint
            )}
          </span>
          {extra ?? <ValueState field={field} value={value} />}
        </div>
      )}
    </div>
  );
}
