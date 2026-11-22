import type { StatDelta } from '@/components/data/stat-card';
import { fmtNum, fmtAuto, fmtMillion } from '@/lib/format';
import type {
  Badge,
  Flag,
  ParamRow,
  PerKind,
  ResultLine,
  StandardKind,
  Triple,
} from './engine-types';

/**
 * Presentation helpers for engine output. They only MAP the API's flags/colours
 * to classes — they never decide whether a value is good or bad (rule 6).
 */
export const flagText: Record<Flag, string> = {
  ok: 'text-brand-600',
  bad: 'text-danger-600',
  neutral: 'text-ink-700',
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

// ---------------------------------------------------------------------------
// v1.1 helpers
// ---------------------------------------------------------------------------

/**
 * Extract the PerKind for a given standard from a ParamRow.
 * Falls back to a synthetic PerKind from the legacy flat keys when
 * the v1.1 `standards` block is absent.
 */
export function perKindOf(row: ParamRow, kind: StandardKind): PerKind {
  if (row.standards) return row.standards[kind];
  // Legacy fallback (v1.0 payload)
  const legacyResult = (t: Triple, pct: number | null): ResultLine => ({
    qty: t.var,
    pct,
    text: null,
    flag: t.varFlag,
  });
  const t = row.today!;
  const m = row.mtd!;
  const u = row.utd!;
  return {
    today: t,
    mtd: m,
    utd: u,
    events: row.events!,
    results: {
      today: legacyResult(t, null),
      mtd: legacyResult(m, row.mtdPct ?? null),
      utd: legacyResult(u, row.utdResult?.pct ?? null),
    },
  };
}
