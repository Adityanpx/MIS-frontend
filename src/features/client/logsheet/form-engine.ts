/**
 * Pure logsheet logic (no React): parsing inputs, live previews and the same checks the API runs.
 * The API stays the authority — this only lets the user see problems while typing (LOG-04, LOG-08…LOG-12).
 * Mirrors backend logsheets/validation.ts and engine/core/derive.ts; change both together.
 */
import { evalFormula, FormulaError, orderCalculated, parseFormula, type FormulaNode } from '@/shared/formula';
import type { FieldIssue, FormField, LogsheetForm, ValueItem, ValueOut } from './types';

/** What the user typed, by parameterId (strings, so "12." and "" survive while typing). */
export type RawValues = Record<string, string>;

export const isTyped = (f: FormField) => f.inputMode !== 'calculated';
export const isText = (f: FormField) => f.aggregation === 'text';
/** Received quantities default to 0 when left empty (backend isDefaultZero). */
export const defaultsToZero = (f: FormField) => f.linkRole === 'received' || f.linkRole === 'cash_received';
const WHOLE_ROLES = ['vacant', 'present', 'leave', 'available'];

export function allFields(form: LogsheetForm): FormField[] {
  return form.blocks.flatMap((b) => b.fields);
}

/** Initial input strings from the stored values. */
export function initialRaw(form: LogsheetForm): RawValues {
  const out: RawValues = {};
  for (const f of allFields(form)) {
    const v = form.values[f.parameterId];
    // numbers: drop float noise (26.220000000004 → "26.22") without cutting real decimals
    if (v !== undefined && v !== null && isTyped(f))
      out[f.parameterId] = typeof v === 'number' ? String(Number(v.toFixed(6))) : String(v);
  }
  return out;
}

/** "1,30,462.5" → 130462.5 · "" → null · "abc" → NaN (reported as "Must be a number"). */
export function parseNumber(s: string): number | null {
  const t = s.replace(/[\s,₹]/g, '');
  if (t === '') return null;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(t)) return Number.NaN;
  return Number(t);
}

export function parseValue(f: FormField, raw: string | undefined): ValueOut {
  if (raw === undefined) return null;
  if (isText(f)) {
    const t = raw.trim();
    return t === '' ? null : t;
  }
  return parseNumber(raw);
}

/** The values the API will see, by parameter CODE (numbers may be NaN while invalid). */
export function valuesByCode(form: LogsheetForm, raw: RawValues): Map<string, ValueOut> {
  const m = new Map<string, ValueOut>();
  for (const f of allFields(form)) if (isTyped(f)) m.set(f.code, parseValue(f, raw[f.parameterId]));
  return m;
}

const num = (v: ValueOut | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ------------------------------------------------------------------ calculated & suggested (derive.ts)
const compiled = new WeakMap<LogsheetForm, Array<{ code: string; node: FormulaNode }>>();
function compile(form: LogsheetForm) {
  const hit = compiled.get(form);
  if (hit) return hit;
  const formulas: Record<string, string> = {};
  for (const f of allFields(form)) if (f.inputMode !== 'typed' && f.formula) formulas[f.code] = f.formula;
  let list: Array<{ code: string; node: FormulaNode }> = [];
  try {
    list = orderCalculated(formulas).map((code) => ({ code, node: parseFormula(formulas[code]!) }));
  } catch (e) {
    if (!(e instanceof FormulaError)) throw e; // a broken formula only disables the preview
  }
  compiled.set(form, list);
  return list;
}

/** Live values of calculated and suggested parameters (lookup order: calculated → typed → constants). */
export function computeCalculated(form: LogsheetForm, byCode: Map<string, ValueOut>): Record<string, number | null> {
  const calc: Record<string, number | null> = {};
  for (const f of compile(form)) {
    try {
      calc[f.code] = evalFormula(f.node, (ref) => {
        if (ref in calc) return calc[ref] ?? null;
        const typed = num(byCode.get(ref));
        if (typed !== null) return typed;
        return form.context.constants[ref] ?? null;
      });
    } catch {
      calc[f.code] = null;
    }
  }
  return calc;
}

// ------------------------------------------------------------------ previews (§13.5, §13.7, §13.8)
export interface StockPreview {
  code: string;
  name: string;
  opening: number | null;
  consumed: number;
  received: number;
  closing: number | null;
  minLevel: number | null;
  state: 'ok' | 'low' | 'negative' | 'unknown';
}
export function stockPreview(form: LogsheetForm, byCode: Map<string, ValueOut>): StockPreview[] {
  return form.context.stockItems.map((i) => {
    const opening = form.context.previousClosing[i.code] ?? null;
    const consumed = num(byCode.get(i.consumedCode)) ?? 0;
    const received = num(byCode.get(i.receivedCode)) ?? 0;
    const closing = opening === null ? null : opening - consumed + received;
    const state =
      closing === null
        ? 'unknown'
        : closing < 0
          ? 'negative'
          : i.minLevel !== null && closing < i.minLevel
            ? 'low'
            : 'ok';
    return { code: i.code, name: i.name, opening, consumed, received, closing, minLevel: i.minLevel, state };
  });
}

export interface CashPreview {
  opening: number | null;
  expense: number;
  received: number;
  closing: number | null;
  limit: number | null;
  overLimit: boolean;
  expenseCode: string | null;
  receivedCode: string | null;
  descriptionCode: string | null;
}
export function cashPreview(form: LogsheetForm, byCode: Map<string, ValueOut>): CashPreview {
  const fields = allFields(form);
  const code = (role: string) => fields.find((f) => f.linkRole === role)?.code ?? null;
  const expenseCode = code('expense');
  const receivedCode = code('cash_received');
  const expense = expenseCode ? (num(byCode.get(expenseCode)) ?? 0) : 0;
  const received = receivedCode ? (num(byCode.get(receivedCode)) ?? 0) : 0;
  const opening = form.context.previousCash;
  const limit = form.context.cashAlertLimit;
  return {
    opening,
    expense,
    received,
    closing: opening === null ? null : opening - expense + received,
    limit,
    overLimit: limit !== null && expense > limit,
    expenseCode,
    receivedCode,
    descriptionCode: code('description'),
  };
}

export interface StaffPreview {
  code: string;
  name: string;
  strength: number;
  vacant: number;
  present: number;
  leave: number;
  absent: number;
  over: boolean;
  codes: { vacant: string; present: string; leave: string };
}
export function staffPreview(form: LogsheetForm, byCode: Map<string, ValueOut>): StaffPreview[] {
  return form.context.staff.map((c) => {
    const vacant = num(byCode.get(c.vacantCode)) ?? 0;
    const present = num(byCode.get(c.presentCode)) ?? 0;
    const leave = num(byCode.get(c.leaveCode)) ?? 0;
    const sum = vacant + present + leave;
    return {
      code: c.code,
      name: c.name,
      strength: c.strength,
      vacant,
      present,
      leave,
      absent: c.strength - sum,
      over: sum > c.strength,
      codes: { vacant: c.vacantCode, present: c.presentCode, leave: c.leaveCode },
    };
  });
}

// ------------------------------------------------------------------ checks (validation.ts)
/** Soft check of one value against its standard: the event rule and warning limits (e.g. PF < 0.95). */
export function standardState(f: FormField, v: number): 'ok' | 'event' | 'limit' {
  const st = f.standard;
  if (!st) return 'ok';
  if (f.eventRule === 'outside_range') {
    if ((st.min !== null && v < st.min) || (st.max !== null && v > st.max)) return 'event';
    return 'ok';
  }
  if (f.eventRule === 'above_std' && st.std !== null && v > st.std) return 'event';
  if (f.eventRule === 'below_std' && st.std !== null && v < st.std) return 'event';
  if ((st.min !== null && v < st.min) || (st.max !== null && v > st.max)) return 'limit';
  return 'ok';
}

export interface Checks {
  /** hard errors by parameterId (block submit / draft save) */
  errors: Record<string, string>;
  /** soft warnings (shown, submit still allowed) */
  warnings: FieldIssue[];
}

/** full = submit/correct (mandatory + cross-field rules); otherwise draft (types and ranges only). */
export function runChecks(form: LogsheetForm, byCode: Map<string, ValueOut>, full: boolean): Checks {
  const errors: Record<string, string> = {};
  const warnings: FieldIssue[] = [];
  const fields = allFields(form).filter(isTyped);
  const byCodeField = new Map(fields.map((f) => [f.code, f]));
  const err = (f: FormField | undefined, m: string) => {
    if (f && !errors[f.parameterId]) errors[f.parameterId] = m;
  };
  for (const f of fields) {
    const v = byCode.get(f.code);
    if (v === null || v === undefined) {
      if (!defaultsToZero(f) && full && f.mandatory && !isText(f)) err(f, 'Required');
      continue;
    }
    if (isText(f)) {
      const max = f.code === 'REMARKS' ? 1000 : 500;
      if (typeof v === 'string' && v.length > max) err(f, `Too long (max ${max} characters)`);
      continue;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      err(f, 'Must be a number');
      continue;
    }
    if (f.hardMin !== null && v < f.hardMin) err(f, `Must be at least ${f.hardMin}`);
    if (f.hardMax !== null && v > f.hardMax) err(f, `Must be at most ${f.hardMax}`);
    if (f.decimals === 0 && WHOLE_ROLES.includes(f.linkRole ?? '') && !Number.isInteger(v))
      err(f, 'Must be a whole number');
    const s = standardState(f, v);
    if (s === 'event')
      warnings.push({ code: f.code, parameterId: f.parameterId, message: `${f.name}: ${v} is outside the standard` });
    if (s === 'limit')
      warnings.push({
        code: f.code,
        parameterId: f.parameterId,
        message: `${f.name}: ${v} is outside the warning limit`,
      });
  }
  if (full) {
    for (const c of staffPreview(form, byCode)) {
      if (c.over) {
        err(
          byCodeField.get(c.codes.present),
          `Vacant + present + leave (${c.vacant + c.present + c.leave}) exceeds the strength ${c.strength}`,
        );
      }
    }
    const cash = cashPreview(form, byCode);
    if (cash.descriptionCode && cash.expense > 0 && !String(byCode.get(cash.descriptionCode) ?? '').trim()) {
      err(byCodeField.get(cash.descriptionCode), 'Describe the expenses');
    }
    if (cash.overLimit && cash.expenseCode) {
      const f = byCodeField.get(cash.expenseCode);
      if (f)
        warnings.push({
          code: f.code,
          parameterId: f.parameterId,
          message: `Expenses ₹${cash.expense} exceed the daily limit ₹${cash.limit}`,
        });
    }
    for (const s of stockPreview(form, byCode)) {
      if (s.state === 'negative' || s.state === 'low') {
        const item = form.context.stockItems.find((i) => i.code === s.code);
        const f = item ? byCodeField.get(item.consumedCode) : undefined;
        warnings.push({
          code: f?.code ?? s.code,
          parameterId: f?.parameterId ?? '',
          message: `${s.name} closing balance ${s.closing} is ${s.state === 'negative' ? 'negative' : 'below the minimum level'}`,
        });
      }
    }
  }
  return { errors, warnings };
}

// ------------------------------------------------------------------ progress & payload
export interface BlockProgress {
  block: number;
  title: string;
  filled: number;
  total: number;
}
/** Mandatory, non-text, typed fields that have a value (received/cash received count as filled: they default to 0). */
export function progress(
  form: LogsheetForm,
  byCode: Map<string, ValueOut>,
): { blocks: BlockProgress[]; filled: number; total: number } {
  const blocks = form.blocks.map((b) => {
    const req = b.fields.filter((f) => isTyped(f) && f.mandatory && !isText(f) && !defaultsToZero(f));
    const filled = req.filter((f) => num(byCode.get(f.code)) !== null).length;
    return { block: b.block, title: b.title, filled, total: req.length };
  });
  return {
    blocks,
    filled: blocks.reduce((s, b) => s + b.filled, 0),
    total: blocks.reduce((s, b) => s + b.total, 0),
  };
}

/** Body items for PUT (draft) / submit: every typed field (null clears a stored value). */
export function toItems(form: LogsheetForm, raw: RawValues): ValueItem[] {
  return allFields(form)
    .filter(isTyped)
    .map((f) => {
      const v = parseValue(f, raw[f.parameterId]);
      return { parameterId: f.parameterId, value: typeof v === 'number' && !Number.isFinite(v) ? null : v };
    });
}

/** Only the fields that differ from the stored values (corrections / correction requests). */
export function changedItems(form: LogsheetForm, raw: RawValues): ValueItem[] {
  const base = initialRaw(form);
  return toItems(form, raw).filter((it) => {
    const f = allFields(form).find((x) => x.parameterId === it.parameterId)!;
    const before = parseValue(f, base[it.parameterId]);
    return before !== it.value;
  });
}

/** Maps API errors (VALIDATION_FAILED → details.fields) onto parameter ids. */
export function apiFieldErrors(details: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const fields = details?.fields;
  if (Array.isArray(fields)) {
    for (const f of fields as FieldIssue[]) if (f.parameterId && !out[f.parameterId]) out[f.parameterId] = f.message;
  }
  return out;
}

/** "DG_HRS * DG_CAPACITY_KW * DG_LOAD_FACTOR" with the parameter/constant names, for tooltips. */
export function explainFormula(form: LogsheetForm, formula: string): string {
  const names = new Map(allFields(form).map((f) => [f.code, f.name]));
  return formula.replace(/[A-Z][A-Z0-9_]+/g, (c) => names.get(c) ?? c.replace(/_/g, ' ').toLowerCase());
}
