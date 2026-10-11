import type { StatDelta } from '@/components/data/stat-card';
import { fmtAuto, fmtMillion, fmtNum } from '@/lib/format';
import type { Badge, Flag } from './engine-types';

/**
 * Presentation helpers for engine output. They only MAP the API's flags/colours to classes — they never decide
 * whether a value is good or bad (rule 6).
 */
export const flagText: Record<Flag, string> = { ok: 'text-brand-600', bad: 'text-danger-600', neutral: 'text-ink-700' };
export const flagBg: Record<Flag, string> = {
  ok: 'bg-brand-50 text-brand-600',
  bad: 'bg-danger-50 text-danger-600',
  neutral: 'bg-muted-bg text-ink-700',
};

/** API badge (fraction) → DeltaPill props (percent). */
export function badgeDelta(b: Badge | null | undefined): StatDelta | undefined {
  if (!b || b.pct === null) return undefined;
  return { value: b.pct * 100, arrow: b.arrow, colour: b.colour };
}

/** Value with the engine's unit: revenue (₹ million) becomes ₹ lakh/crore, everything else Indian grouping. */
export function fmtUnitValue(v: number | null | undefined, unit: string, decimals?: number): string {
  if (unit === '₹ million') return fmtMillion(v);
  return decimals === undefined ? fmtAuto(v) : fmtNum(v, decimals);
}
export const isMoneyUnit = (unit: string) => unit === '₹ million';
export const unitLabel = (unit: string) => (isMoneyUnit(unit) ? '' : unit);

/** "2026-09-21" → "Mon". */
export const weekday = (iso: string) =>
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${iso}T00:00:00Z`).getUTCDay()] ?? '';
