'use client';

import {
  Banknote,
  Beaker,
  ClipboardList,
  FlaskConical,
  Gauge,
  HardHat,
  MessageSquareText,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { DASH, fmtMoney0, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { FieldError, FieldRow, ValueBox } from './field-input';
import { cashPreview, initialRaw, isText, staffPreview, stockPreview, type BlockProgress } from './form-engine';
import type { FormBlock, FormField, LogsheetForm } from './types';
import type { LogsheetEditor } from './use-logsheet-editor';

export const BLOCK_ICON: Record<number, LucideIcon> = {
  1: Gauge,
  2: Package,
  3: Beaker,
  4: FlaskConical,
  5: HardHat,
  6: Users,
  7: Banknote,
  8: MessageSquareText,
};
export const blockIcon = (n: number) => BLOCK_ICON[n] ?? ClipboardList;

/** Small progress ring used in block headers and the side panel. */
export function Ring({
  value,
  max,
  size = 36,
  stroke = 4,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max === 0 ? 1 : Math.min(1, value / max);
  const done = pct >= 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink-200)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={done ? 'var(--color-success-500)' : 'var(--color-brand-500)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        initial={false}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

function BlockShell({ block, prog, children }: { block: FormBlock; prog?: BlockProgress; children: ReactNode }) {
  const done = !!prog && prog.total > 0 && prog.filled >= prog.total;
  return (
    <motion.section
      id={`block-${block.block}`}
      className="scroll-mt-28"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(block.block, 8) * 0.03 }}
    >
      <Card padded={false} className="h-full rounded-md! p-3.5">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 className="text-ink-900 text-sm font-semibold">{block.title}</h2>
          {prog && prog.total > 0 && (
            <span className={cn('tabular text-xs font-medium', done ? 'text-success-600' : 'text-ink-500')}>
              {prog.filled}/{prog.total}
            </span>
          )}
        </div>
        {children}
      </Card>
    </motion.section>
  );
}

interface Common {
  form: LogsheetForm;
  ed: LogsheetEditor;
  original: Record<string, string>;
}
const inCorrection = (ed: LogsheetEditor) => ed.mode === 'correct' || ed.mode === 'request';

function TextRow({ ed, f, original }: Omit<Common, 'form'> & { f: FormField }) {
  const value = ed.raw[f.parameterId] ?? '';
  const changed = inCorrection(ed) && (original[f.parameterId] ?? '') !== value;
  const error = ed.errors[f.parameterId];
  return (
    <div className="min-w-0 sm:col-span-full" id={`f-${f.parameterId}`}>
      <label className="text-ink-700 mb-1.5 block text-[13px] font-medium" htmlFor={`in-${f.parameterId}`}>
        {f.name}
      </label>
      {ed.editable ? (
        <Textarea
          id={`in-${f.parameterId}`}
          rows={3}
          value={value}
          invalid={!!error}
          onChange={(e) => ed.setValue(f.parameterId, e.target.value)}
          placeholder={f.linkRole === 'description' ? 'What was the cash spent on?' : 'Anything worth noting today…'}
          className={cn(changed && 'border-brand-400 bg-brand-50/50')}
        />
      ) : (
        <p className="rounded-control border-line bg-canvas/60 text-ink-700 min-h-11 border border-dashed px-3.5 py-2.5 text-sm whitespace-pre-wrap">
          {value || <span className="text-ink-300">{DASH}</span>}
        </p>
      )}
      <FieldError message={error} />
    </div>
  );
}

function Grid({ fields, ...c }: Common & { fields: FormField[] }) {
  const typed = fields.filter((f) => !isText(f));
  const text = fields.filter(isText);
  return (
    <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
      {typed.map((f) => (
        <FieldRow
          key={f.parameterId}
          field={f}
          raw={c.ed.raw[f.parameterId] ?? ''}
          onChange={(v) => c.ed.setValue(f.parameterId, v)}
          editable={c.ed.editable && f.inputMode !== 'calculated'}
          error={c.ed.errors[f.parameterId]}
          calcValue={c.ed.calc[f.code] ?? null}
          original={inCorrection(c.ed) ? (c.original[f.parameterId] ?? '') : undefined}
        />
      ))}
      {text.map((f) => (
        <TextRow key={f.parameterId} f={f} {...c} />
      ))}
    </div>
  );
}

/** stock quantities: 2 decimals at most, no float noise */
const qty = (v: number | null) => (v === null ? DASH : fmtNum(Math.round(v * 100) / 100));

const th = 'pb-1 text-[11px] font-medium tracking-wider text-ink-400 uppercase';

/** Chemicals & consumables: opening → consumed / received → closing preview per stock item (§13.7). */
function StockTable({ fields, ...c }: Common & { fields: FormField[] }) {
  const rows = stockPreview(c.form, c.ed.byCode);
  const byCode = new Map(fields.map((f) => [f.code, f]));
  const used = new Set<string>();
  const items = c.form.context.stockItems.filter((i) => byCode.has(i.consumedCode));
  const box = (f: FormField | undefined) => {
    if (!f) return <span className="text-ink-300">{DASH}</span>;
    used.add(f.code);
    return (
      <div>
        <ValueBox
          field={f}
          aria-label={f.name}
          value={c.ed.raw[f.parameterId] ?? ''}
          onChange={(v) => c.ed.setValue(f.parameterId, v)}
          editable={c.ed.editable}
          error={c.ed.errors[f.parameterId]}
          changed={inCorrection(c.ed) && (c.original[f.parameterId] ?? '') !== (c.ed.raw[f.parameterId] ?? '')}
        />
        <FieldError message={c.ed.errors[f.parameterId]} />
      </div>
    );
  };
  const rest = () => fields.filter((f) => !used.has(f.code));
  return (
    <>
      <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
        <table className="w-full border-separate border-spacing-y-1">
          <thead>
            <tr className="text-left">
              <th className={th}>Item</th>
              <th className={cn(th, 'text-right')}>Opening</th>
              <th className={cn(th, 'w-[26%] pl-2')}>Consumed</th>
              <th className={cn(th, 'w-[26%] pl-2')}>Received</th>
              <th className={cn(th, 'text-right')}>Closing</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const p = rows.find((r) => r.code === i.code)!;
              const cf = byCode.get(i.consumedCode);
              const std = cf?.standard?.std ?? null;
              return (
                <tr key={i.code} className="align-top">
                  <td className="py-1 pr-3">
                    <p className="text-ink-900 pt-2 text-sm font-semibold">{i.name}</p>
                    <p className="text-ink-400 text-[11px] whitespace-nowrap">
                      {cf?.unit}
                      {std !== null && ` · std ${fmtNum(std)}/day`}
                    </p>
                  </td>
                  <td className="text-ink-500 tabular py-1 pt-3 text-right text-sm">{qty(p.opening)}</td>
                  <td className="py-1 pl-2">{box(cf)}</td>
                  <td className="py-1 pl-2">{box(byCode.get(i.receivedCode))}</td>
                  <td className="py-1 pt-1 text-right">
                    <span
                      className={cn(
                        'tabular inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-semibold',
                        p.state === 'negative'
                          ? 'bg-danger-50 text-danger-600'
                          : p.state === 'low'
                            ? 'bg-warning-50 text-warning-600'
                            : 'bg-success-50 text-success-600',
                        p.state === 'unknown' && 'bg-muted-bg text-ink-500',
                      )}
                    >
                      {qty(p.closing)}
                    </span>
                    {(p.state === 'low' || p.state === 'negative') && (
                      <p className="text-warning-600 mt-1 text-[11px] font-medium">
                        {p.state === 'negative' ? 'Negative balance' : `Below min ${fmtNum(p.minLevel)}`}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rest().length > 0 && (
        <div className="border-line mt-4 border-t border-dashed pt-4">
          <Grid fields={rest()} {...c} />
        </div>
      )}
    </>
  );
}

/** Staff attendance: vacant + present + leave ≤ strength, absent derived (§13.5). */
function StaffTable({ fields, ...c }: Common & { fields: FormField[] }) {
  const rows = staffPreview(c.form, c.ed.byCode);
  const byCode = new Map(fields.map((f) => [f.code, f]));
  const cell = (code: string) => {
    const f = byCode.get(code);
    if (!f) return <span className="text-ink-300">{DASH}</span>;
    return (
      <ValueBox
        field={f}
        aria-label={f.name}
        value={c.ed.raw[f.parameterId] ?? ''}
        onChange={(v) => c.ed.setValue(f.parameterId, v)}
        editable={c.ed.editable}
        error={c.ed.errors[f.parameterId]}
        changed={inCorrection(c.ed) && (c.original[f.parameterId] ?? '') !== (c.ed.raw[f.parameterId] ?? '')}
      />
    );
  };
  return (
    <div className="scrollbar-thin -mx-1 overflow-x-auto px-1">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr className="text-left">
            <th className={th}>Category</th>
            <th className={cn(th, 'text-right')}>Strength</th>
            <th className={cn(th, 'pl-2')}>Vacant</th>
            <th className={cn(th, 'pl-2')}>Present</th>
            <th className={cn(th, 'pl-2')}>On leave</th>
            <th className={cn(th, 'text-right')}>Absent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const err =
              c.ed.errors[byCode.get(r.codes.present)?.parameterId ?? ''] ??
              c.ed.fullChecks.errors[byCode.get(r.codes.present)?.parameterId ?? ''];
            return (
              <tr key={r.code} className="align-top">
                <td className="py-1 pr-3">
                  <p className="text-ink-900 pt-2 text-sm font-semibold">{r.name}</p>
                  {err && r.over && <p className="text-danger-600 text-[11px] font-medium">Exceeds strength</p>}
                </td>
                <td className="text-ink-700 tabular py-1 pt-3 text-right text-sm font-semibold">{r.strength}</td>
                <td className="w-[22%] py-1 pl-2">{cell(r.codes.vacant)}</td>
                <td className="w-[22%] py-1 pl-2">{cell(r.codes.present)}</td>
                <td className="w-[22%] py-1 pl-2">{cell(r.codes.leave)}</td>
                <td className="py-1 pt-1 text-right">
                  <span
                    className={cn(
                      'tabular inline-flex h-8 min-w-10 items-center justify-center rounded-lg px-2.5 text-sm font-semibold',
                      r.absent < 0
                        ? 'bg-danger-50 text-danger-600'
                        : r.absent > 0
                          ? 'bg-warning-50 text-warning-600'
                          : 'bg-success-50 text-success-600',
                    )}
                  >
                    {r.absent}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Site cash: in hand yesterday − expenses + received = in hand today (§13.8). */
function CashPanel({ fields, ...c }: Common & { fields: FormField[] }) {
  const p = cashPreview(c.form, c.ed.byCode);
  const exp = fields.find((f) => f.linkRole === 'expense');
  const rec = fields.find((f) => f.linkRole === 'cash_received');
  const other = fields.filter((f) => f !== exp && f !== rec);
  const field = (f: FormField, extra?: ReactNode) => (
    <FieldRow
      field={f}
      raw={c.ed.raw[f.parameterId] ?? ''}
      onChange={(v) => c.ed.setValue(f.parameterId, v)}
      editable={c.ed.editable}
      error={c.ed.errors[f.parameterId]}
      original={inCorrection(c.ed) ? (c.original[f.parameterId] ?? '') : undefined}
      extra={extra}
    />
  );
  return (
    <div className="space-y-3">
      <div className="grid gap-x-3 gap-y-2 sm:grid-cols-2">
        <div>
          <p className="text-ink-700 mb-1 text-[13px] font-medium">In hand yesterday</p>
          <div className="rounded-control bg-muted-bg text-ink-700 tabular flex h-10 items-center justify-end px-3 text-sm font-semibold">
            {fmtMoney0(p.opening)}
          </div>
        </div>
        <div>
          <p className="text-ink-700 mb-1 text-[13px] font-medium">In hand today</p>
          <div
            className={cn(
              'rounded-control tabular flex h-10 items-center justify-end px-3 text-sm font-bold',
              p.closing !== null && p.closing < 0 ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600',
            )}
          >
            {fmtMoney0(p.closing)}
          </div>
        </div>
        {exp &&
          field(
            exp,
            p.overLimit ? (
              <span className="text-warning-600 text-[11px] font-semibold">Above ₹{fmtNum(p.limit)} limit</span>
            ) : p.limit !== null ? (
              <span className="text-ink-400 text-[11px]">Limit ₹{fmtNum(p.limit)}/day</span>
            ) : null,
          )}
        {rec && field(rec)}
      </div>
      {other.length > 0 && <Grid fields={other} {...c} />}
    </div>
  );
}

/** Renders one logsheet block with the layout that suits its content. */
export function LogsheetBlock({
  form,
  block,
  ed,
  prog,
}: {
  form: LogsheetForm;
  block: FormBlock;
  ed: LogsheetEditor;
  prog?: BlockProgress;
}) {
  const original = initialRaw(form);
  const c = { form, ed, original };
  const roles = new Set(block.fields.map((f) => f.linkRole));
  let body: ReactNode;
  if (roles.has('consumed')) body = <StockTable fields={block.fields} {...c} />;
  else if (roles.has('present') || roles.has('vacant')) body = <StaffTable fields={block.fields} {...c} />;
  else if (roles.has('expense')) body = <CashPanel fields={block.fields} {...c} />;
  else {
    body = <Grid fields={block.fields} {...c} />;
  }
  return (
    <BlockShell block={block} prog={prog}>
      {body}
    </BlockShell>
  );
}
