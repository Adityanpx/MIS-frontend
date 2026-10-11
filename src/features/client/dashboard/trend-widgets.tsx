'use client';

import { ArrowUpRight, Zap } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { PillBars } from '@/components/charts/pill-bars';
import { SplitBars } from '@/components/charts/split-bars';
import { TrendChart } from '@/components/charts/trend-chart';
import { DeltaPill } from '@/components/ui/badge';
import { Card, CardHeader, CardMenu, Panel } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { CountUp } from '@/components/motion/count-up';
import { addDays, addMonths, startOfMonth } from '@/lib/dates';
import { fmtDay, fmtNum } from '@/lib/format';
import { useTrend } from '../engine-queries';
import type { ParamCard, TrendRow } from '../engine-types';
import { badgeDelta, fmtUnitValue, unitLabel, weekday } from '../engine-ui';

const maxISO = (a: string, b: string) => (a > b ? a : b);

/** One request (previous month start … report date) feeds both the trend chart and the last-7-days bars. */
export function useFocusSeries(plantId: string, code: string | null, date: string, misStart: string) {
  const from = maxISO(misStart, addMonths(startOfMonth(date), -1));
  const q = useTrend(plantId, code, from, date);
  return useMemo(() => {
    const rows: TrendRow[] = q.data?.rows ?? [];
    const curStart = startOfMonth(date);
    const prevStart = addMonths(curStart, -1);
    const cur = rows.filter((r) => r.date >= curStart);
    const prev = new Map(
      rows.filter((r) => r.date >= prevStart && r.date < curStart).map((r) => [Number(r.date.slice(8)), r]),
    );
    const daysInMonth = Number(addDays(addMonths(curStart, 1), -1).slice(8));
    const series = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const c = cur.find((r) => Number(r.date.slice(8)) === day);
      return {
        day: String(day),
        current: c?.value ?? null,
        previous: prev.get(day)?.value ?? null,
        date: c?.date ?? `${curStart.slice(0, 8)}${String(day).padStart(2, '0')}`,
      };
    });
    const values = cur.map((r) => r.value).filter((v): v is number => v !== null);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    const std = [...cur].reverse().find((r) => r.std !== null)?.std ?? null;
    const last7 = rows.filter((r) => r.date > addDays(date, -7) && r.date <= date);
    return { query: q, series, avg, std, last7 };
  }, [q, date]);
}

export function TrendWidget({
  plantId,
  date,
  misStart,
  focus,
  cards,
  onFocus,
  powerCards,
}: {
  plantId: string;
  date: string;
  misStart: string;
  focus: ParamCard | null;
  cards: ParamCard[];
  onFocus: (code: string) => void;
  powerCards: ParamCard[];
}) {
  const s = useFocusSeries(plantId, focus?.code ?? null, date, misStart);
  const unit = focus?.unit ?? '';
  const tones = ['blue', 'green', 'orange', 'purple'] as const;
  return (
    <Card>
      <CardHeader
        title={focus ? `${focus.title} — daily` : 'Daily trend'}
        subtitle={`${fmtDay(startOfMonth(date))} – ${fmtDay(date)} against the same days last month`}
        action={
          <>
            <Select
              size="sm"
              className="w-44"
              value={focus?.code}
              onValueChange={onFocus}
              aria-label="Parameter"
              options={cards.filter((c) => c.code !== 'REVENUE').map((c) => ({ value: c.code, label: c.title }))}
            />
            <CardMenu
              items={[
                {
                  label: 'Open trend report',
                  onSelect: () => window.location.assign(`/plants/${plantId}/reports/trend?param=${focus?.code ?? ''}`),
                },
              ]}
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-center">
        <div>
          <p className="text-ink-500 text-xs font-medium">Average per day, this month</p>
          <div className="text-ink-900 mt-2 text-[40px] leading-none font-bold tracking-tight">
            {s.query.isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <CountUp value={s.avg} format={(n) => fmtUnitValue(n, unit)} />
            )}
          </div>
          <p className="text-ink-500 mt-1 text-sm">{unitLabel(unit)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {focus && <DeltaPill {...(badgeDelta(focus.mtd) ?? { value: null })} />}
            <span className="text-ink-500 text-xs">MTD vs standard</span>
          </div>
          {s.std !== null && (
            <p className="text-ink-500 mt-3 text-xs">
              Standard {fmtUnitValue(s.std, unit)} {unitLabel(unit)}/day
            </p>
          )}
        </div>
        {s.query.isLoading ? (
          <Skeleton className="rounded-inner h-[240px] w-full" />
        ) : (
          <TrendChart
            data={s.series}
            xKey="day"
            series={[
              { key: 'current', label: 'this month' },
              { key: 'previous', label: 'last month', dashed: true },
            ]}
            format={(v) => `${fmtUnitValue(v, unit)} ${unitLabel(unit)}`}
            tooltipTitle={(_, row) => fmtDay(String(row.date))}
            reference={s.std !== null ? { y: s.std, label: 'Standard' } : undefined}
            minTickGap={16}
          />
        )}
      </div>
      {powerCards.length >= 2 && (
        <Panel className="mt-6">
          <CardHeader className="mb-3" title="Power this month" subtitle="kWh, month to date" icon={<Zap />} />
          <SplitBars
            items={powerCards.slice(0, 4).map((c, i) => ({
              label: c.title,
              value: c.mtd.value,
              tone: tones[i] ?? 'blue',
              format: (n: number) => fmtNum(n, 0),
            }))}
          />
        </Panel>
      )}
    </Card>
  );
}

export function Last7Widget({
  plantId,
  date,
  misStart,
  focus,
}: {
  plantId: string;
  date: string;
  misStart: string;
  focus: ParamCard | null;
}) {
  const s = useFocusSeries(plantId, focus?.code ?? null, date, misStart);
  const unit = focus?.unit ?? '';
  const data = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(date, i - 6);
    const r = s.last7.find((x) => x.date === d);
    return { label: weekday(d), value: r?.value ?? null, hint: fmtDay(d) };
  });
  return (
    <Card>
      <CardHeader
        title="Last 7 days"
        subtitle={focus ? `${focus.title} · ${unitLabel(unit)}` : undefined}
        action={
          <Link
            href={`/plants/${plantId}/reports/trend?param=${focus?.code ?? ''}`}
            className="text-ink-400 hover:bg-muted-bg hover:text-ink-900 grid size-8 place-items-center rounded-full"
            aria-label="Open trend report"
          >
            <ArrowUpRight className="size-[18px]" />
          </Link>
        }
      />
      {s.query.isLoading ? (
        <Skeleton className="rounded-inner h-[200px] w-full" />
      ) : (
        <PillBars data={data} highlight="last" format={(v) => fmtUnitValue(v, unit)} />
      )}
    </Card>
  );
}
