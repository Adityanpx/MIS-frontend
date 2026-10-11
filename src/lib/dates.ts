/**
 * Business dates are plain 'YYYY-MM-DD' strings in India time (same rule as the backend's lib/dates.ts).
 * Never use `new Date('2026-09-21')` for business logic: it is UTC midnight and shifts in other zones.
 */
export type ISODate = string;

/** Today in India (Asia/Kolkata) as 'YYYY-MM-DD'. */
export function todayIST(): ISODate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

const toUTC = (iso: ISODate) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const fromUTC = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: ISODate, n: number): ISODate => fromUTC(toUTC(iso) + n * 86_400_000);
export const diffDays = (a: ISODate, b: ISODate): number => Math.round((toUTC(a) - toUTC(b)) / 86_400_000);
export const isValidISODate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUTC(toUTC(s)) === s;
export const clampDate = (iso: ISODate, min?: ISODate | null, max?: ISODate | null): ISODate =>
  min && iso < min ? min : max && iso > max ? max : iso;

export const monthKey = (iso: ISODate) => iso.slice(0, 7); // 'YYYY-MM'
export const startOfMonth = (iso: ISODate): ISODate => `${iso.slice(0, 7)}-01`;
export function endOfMonth(iso: ISODate): ISODate {
  const [y, m] = iso.split('-').map(Number);
  return fromUTC(Date.UTC(y ?? 1970, m ?? 1, 0));
}
export function addMonths(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  const first = Date.UTC(y ?? 1970, (m ?? 1) - 1 + n, 1);
  const last = new Date(Date.UTC(y ?? 1970, (m ?? 1) + n, 0)).getUTCDate();
  return fromUTC(first + (Math.min(d ?? 1, last) - 1) * 86_400_000);
}
/** Indian financial year start (1 April) for a date. */
export function fyStart(iso: ISODate): ISODate {
  const y = Number(iso.slice(0, 4));
  return Number(iso.slice(5, 7)) >= 4 ? `${y}-04-01` : `${y - 1}-04-01`;
}
/** "2026-27" for any date in that FY. */
export function fyLabel(iso: ISODate): string {
  const y = Number(fyStart(iso).slice(0, 4));
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

/** JS Date (local) ↔ ISO date, for date-picker components only. */
export const dateToISO = (d: Date): ISODate =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function isoToDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}
export type RangePreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month' | 'this_fy' | 'custom';

export const RANGE_PRESETS: Array<{ id: Exclude<RangePreset, 'custom'>; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'this_fy', label: 'This financial year' },
];

export function presetRange(p: Exclude<RangePreset, 'custom'>, today: ISODate = todayIST()): DateRange {
  switch (p) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case 'this_month':
      return { from: startOfMonth(today), to: today };
    case 'last_month': {
      const lm = addMonths(startOfMonth(today), -1);
      return { from: lm, to: endOfMonth(lm) };
    }
    case 'this_fy':
      return { from: fyStart(today), to: today };
  }
}

/** Which preset (if any) a range equals — used to show "Last 30 days" next to the dates. */
export function detectPreset(r: DateRange, today: ISODate = todayIST()): RangePreset {
  for (const p of RANGE_PRESETS) {
    const x = presetRange(p.id, today);
    if (x.from === r.from && x.to === r.to) return p.id;
  }
  return 'custom';
}
