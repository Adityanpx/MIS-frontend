/**
 * Display formatting. Indian digit grouping everywhere (1,30,46,190), ₹ for money, DD-MMM-YYYY dates.
 * The grouping itself comes from the backend's shared/format.ts so screen, Excel and PDF always agree.
 * (DESIGN-SPEC suggested de-DE "16.431" — replaced by Indian format, decided with the client.)
 */
import { formatIndian, formatMoney } from '@/shared/format';

type Num = number | string | null | undefined;

const toNumber = (v: Num): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
};

export const DASH = '—';

/** 13046190.5 → "1,30,46,190.50" (decimals optional). */
export function fmtNum(v: Num, decimals?: number): string {
  const n = toNumber(v);
  return n === null ? DASH : formatIndian(n, decimals);
}

/** Number with a unit: "118.40 MLD". */
export function fmtQty(v: Num, unit?: string | null, decimals = 2): string {
  const s = fmtNum(v, decimals);
  return s === DASH || !unit ? s : `${s} ${unit}`;
}

/**
 * Engine values without known decimals (dashboard cards): ≥ 1,000 → no decimals, otherwise up to 2.
 * `fmtAuto(2604)` → "2,604" · `fmtAuto(123.548)` → "123.55" · `fmtAuto(7)` → "7".
 */
export function fmtAuto(v: Num, maxDecimals = 2): string {
  const n = toNumber(v);
  if (n === null) return DASH;
  if (Math.abs(n) >= 1000 || Number.isInteger(n)) return formatIndian(Math.round(n));
  return trim(formatIndian(n, maxDecimals));
}

/** ₹ million (engine revenue unit) → "₹24.7 L" / "₹8.37 Cr". */
export const fmtMillion = (v: Num): string => {
  const n = toNumber(v);
  return n === null ? DASH : fmtCompact(n * 1e6, { money: true });
};

/** Money string or number → "₹70,800.00". */
export function fmtMoney(v: Num): string {
  const n = toNumber(v);
  return n === null ? DASH : formatMoney(n);
}

/** Money without paise for big headline numbers: "₹70,800". */
export function fmtMoney0(v: Num): string {
  const n = toNumber(v);
  return n === null ? DASH : `${n < 0 ? '-' : ''}₹${formatIndian(Math.abs(Math.round(n)))}`;
}

/**
 * Indian compact notation for axes and hero numbers:
 * 950 → "950", 12_400 → "12.4K", 12_40_000 → "12.4 L", 1_30_46_190 → "1.30 Cr".
 */
export function fmtCompact(v: Num, opts: { money?: boolean; decimals?: number } = {}): string {
  const n = toNumber(v);
  if (n === null) return DASH;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const cur = opts.money ? '₹' : '';
  const d = opts.decimals;
  if (abs >= 1e7) return `${sign}${cur}${(abs / 1e7).toFixed(d ?? 2)} Cr`;
  if (abs >= 1e5) return `${sign}${cur}${(abs / 1e5).toFixed(d ?? 1)} L`;
  if (abs >= 1e3) return `${sign}${cur}${trim((abs / 1e3).toFixed(d ?? 1))}K`;
  return `${sign}${cur}${trim(abs.toFixed(d ?? (abs % 1 === 0 ? 0 : 1)))}`;
}
const trim = (s: string) => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

/** 15.456 → "15.5%" (sign optional: "+15.5%"). */
export function fmtPct(v: Num, decimals = 1, withSign = false): string {
  const n = toNumber(v);
  if (n === null) return DASH;
  const s = `${formatIndian(Math.abs(n), decimals)}%`;
  if (n < 0) return `-${s}`;
  return withSign && n > 0 ? `+${s}` : s;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' → "21-Sep-2026" (the format used on every MIS document). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const [y, m, d] = iso.slice(0, 10).split('-');
  const mi = Number(m) - 1;
  if (!y || !d || !(mi >= 0 && mi < 12)) return iso;
  return `${d}-${MONTHS[mi]}-${y}`;
}

/** 'YYYY-MM-DD' → "21 Sep" (chart axes, compact lists). */
export function fmtDay(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`;
}

/** 'YYYY-MM' or 'YYYY-MM-DD' → "Sep 2026". */
export function fmtMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MONTHS[Number(m) - 1] ?? ''} ${y}`;
}

/** 'YYYY-MM' → "Sep" (monthly chart axes). */
export const fmtMonthShort = (iso: string) => MONTHS[Number(iso.split('-')[1]) - 1] ?? iso;

/** ISO timestamp → "21-Sep-2026, 14:05" in India time. */
export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return DASH;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit', // numeric, then our own names: newer browsers spell September "Sept" in 'short'
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('day')}-${MONTHS[Number(get('month')) - 1] ?? get('month')}-${get('year')}, ${hour}:${get('minute')}`;
}

/** "3 min ago", "2 h ago", "5 d ago". */
export function fmtRelative(ts: string | null | undefined): string {
  if (!ts) return DASH;
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
