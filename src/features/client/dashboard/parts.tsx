'use client';

import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Banknote,
  Beaker,
  Clock,
  Droplets,
  FileWarning,
  Flame,
  FlaskConical,
  Fuel,
  IndianRupee,
  Info,
  Package,
  ShieldAlert,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { BarChart } from '@/components/charts/bar-chart';
import { TrendChart } from '@/components/charts/trend-chart';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AlertLevel, CardChart, Flag, PlantAlert } from '../engine-types';
import { fmtUnitValue } from '../engine-ui';

/** Icon for a parameter code (the template's codes; unknown codes get a neutral icon). */
export function paramIcon(code: string): LucideIcon {
  if (code === 'REVENUE') return IndianRupee;
  if (code.includes('INFLOW') || code.includes('FLOW')) return Droplets;
  if (code.endsWith('_KWH')) return Zap;
  if (code.endsWith('_HRS')) return Clock;
  if (code.startsWith('DIESEL')) return Fuel;
  if (code.startsWith('OUT_') || code.startsWith('IN_')) return FlaskConical;
  if (code.includes('CHLOR') || code.includes('POLY') || code.includes('ALUM') || code.includes('LIME')) return Beaker;
  if (code.includes('GAS')) return Flame;
  return Activity;
}

/** "Events MTD 11 · UTD 458" — red when the API flags it. */
export function EventsChip({
  events,
  className,
}: {
  events: { mtd: number; utd: number; flag: Flag };
  className?: string;
}) {
  const bad = events.flag === 'bad';
  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        bad ? 'bg-danger-50 text-danger-600' : 'bg-muted-bg text-ink-500',
        className,
      )}
      title="Days on which the value broke its rule (month to date · since MIS start)"
    >
      Events {fmtNum(events.mtd)} · {fmtNum(events.utd)}
    </span>
  );
}

/** The engine card chart (last 5 completed months): bar, cone or line, exactly as `chart.type` says. */
export function CardMiniChart({
  chart,
  unit,
  height = 120,
  reference,
}: {
  chart: CardChart;
  unit: string;
  height?: number;
  reference?: number | null;
}) {
  const data = chart.months.map((m, i) => ({ label: m.slice(0, 3), value: chart.values[i] ?? null }));
  if (data.every((d) => d.value === null)) {
    return (
      <div className="rounded-inner bg-canvas text-ink-400 grid place-items-center text-xs" style={{ height }}>
        No data for the last five months
      </div>
    );
  }
  if (chart.type === 'line') {
    return (
      <TrendChart
        data={data}
        xKey="label"
        series={[{ key: 'value', label: 'monthly', fill: true }]}
        height={height}
        showYAxis={false}
        format={(v) => fmtUnitValue(v, unit)}
        minTickGap={4}
      />
    );
  }
  return (
    <BarChart
      data={data}
      height={height}
      variant={chart.type === 'cone' ? 'cone' : 'bar'}
      highlight="last"
      showYAxis={false}
      format={(v) => fmtUnitValue(v, unit)}
      seriesLabel="avg"
      reference={reference != null ? { y: reference } : undefined}
    />
  );
}

/** Horizontal band for a lab result: grey track, green allowed zone (min…max), a dot for today's value. */
export function RangeBar({
  value,
  min,
  max,
  bad,
}: {
  value: number | null;
  min: number | null;
  max: number | null;
  bad: boolean;
}) {
  const lo = min ?? 0;
  const hi = max ?? (value !== null ? value * 1.5 : 1);
  const top = Math.max(hi * 1.25, value ?? 0, 1);
  const bottom = min !== null ? Math.min(min * 0.75, value ?? min) : 0;
  const span = top - bottom || 1;
  const pos = (v: number) => `${((v - bottom) / span) * 100}%`;
  return (
    <div className="bg-muted-bg relative h-2.5 w-full rounded-full">
      <div
        className="bg-success-100 absolute inset-y-0 rounded-full"
        style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }}
      />
      {value !== null && (
        <motion.span
          className={cn(
            'absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_2px_6px_rgb(16_24_40/0.25)]',
            bad ? 'bg-danger-500' : 'bg-success-500',
          )}
          initial={{ left: pos(bottom) }}
          whileInView={{ left: pos(value) }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
}

const LEVEL: Record<AlertLevel, { Icon: LucideIcon; well: string; dot: string }> = {
  critical: { Icon: AlertOctagon, well: 'bg-danger-50 text-danger-500', dot: 'bg-danger-500' },
  warning: { Icon: AlertTriangle, well: 'bg-warning-50 text-warning-500', dot: 'bg-warning-500' },
  info: { Icon: Info, well: 'bg-brand-50 text-brand-500', dot: 'bg-brand-400' },
};
const KIND_ICON: Partial<Record<PlantAlert['kind'], LucideIcon>> = {
  stock: Package,
  cash: Banknote,
  staff: Users,
  safety: ShieldAlert,
  register: ShieldAlert,
  logsheet: FileWarning,
  lab: FlaskConical,
};

/** One alert row (dashboard "Today's alerts" and the overview feed). */
export function AlertItem({
  alert,
  href,
  plantName,
  index = 0,
}: {
  alert: PlantAlert;
  href?: string;
  plantName?: string;
  index?: number;
}) {
  const l = LEVEL[alert.level];
  const Icon = KIND_ICON[alert.kind] ?? l.Icon;
  const body = (
    <>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', l.well)}>
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={cn('size-1.5 shrink-0 rounded-full', l.dot)} />
          <span className="text-ink-900 truncate text-[13px] font-semibold">{alert.title}</span>
        </span>
        <span className="text-ink-500 mt-0.5 block truncate text-xs">
          {plantName && <span className="text-ink-700 font-medium">{plantName} · </span>}
          {alert.detail}
        </span>
      </span>
    </>
  );
  const cls = 'flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors';
  return (
    <motion.li
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
    >
      {href ? (
        <Link href={href} className={cn(cls, 'hover:bg-canvas')}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.li>
  );
}

/** Deep link of an alert inside a plant. */
export function alertHref(plantId: string, date: string, a: PlantAlert): string | undefined {
  switch (a.kind) {
    case 'lab':
      return `/plants/${plantId}/mis/${date}#quality`;
    case 'stock':
      return `/plants/${plantId}/reports/stock-ledger?item=${encodeURIComponent((a.code ?? '').replace(/_CONSUMED$/, ''))}`;
    case 'register':
      return `/plants/${plantId}/mis/${date}#registers`;
    case 'cash':
      return `/plants/${plantId}/reports/cash-book`;
    case 'staff':
    case 'safety':
      return `/plants/${plantId}/mis/${date}#staff`;
    case 'param':
      return a.code ? `/plants/${plantId}/reports/trend?param=${a.code}` : undefined;
    case 'logsheet':
      return `/plants/${plantId}/logsheet`;
    default:
      return undefined;
  }
}
