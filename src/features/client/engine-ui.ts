import type { StatDelta } from '@/components/data/stat-card';
import { fmtNum, fmtPct, fmtAuto, fmtMillion } from '@/lib/format';
import type {
  Badge,
  Flag,
  ParamRow,
  PerKind,
  ResultLine,
  ResultMode,
  StandardKind,
  StandardsShown,
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

// ---------------------------------------------------------------------------
// v1.1 helpers
// ---------------------------------------------------------------------------

/**
 * Format a ResultLine for display.
 * "5.8% LESS CHLORINE CONSUMED" / "24.5 kg LESS" / combined.
 */
export function formatResult(
  line: ResultLine,
  unit: string,
  decimals: number,
  mode: ResultMode,
): string {
  if (line.pct === null && line.qty === null) return '—';
  if (!line.text) return '—';
  const pctPart = line.pct !== null ? fmtPct(Math.abs(line.pct) * 100, 1) : null;
  const qtyPart = line.qty !== null ? `${fmtNum(Math.abs(line.qty), decimals)} ${unit}` : null;
  // Strip leading number from the text to get just the verb+noun part
  const verbNoun = line.text
    .replace(/^-?[\d,.]+%\s*/, '')
    .replace(/^-?[\d,.]+ \S+ /, '')
    .trim();
  if (mode === 'pct') return pctPart ? `${pctPart} ${verbNoun}` : '—';
  if (mode === 'qty') return qtyPart ? `${qtyPart} ${verbNoun}` : '—';
  if (mode === 'none') return '—';
  // 'both'
  const parts = [pctPart, qtyPart].filter(Boolean);
  return parts.length ? `${parts.join(' | ')} ${verbNoun}` : '—';
}

/** The standard kinds visible given the SET-09 configuration. */
export function visibleKinds(shown: StandardsShown): StandardKind[] {
  if (shown === 'both') return ['bidding', 'actual'];
  return [shown];
}

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
