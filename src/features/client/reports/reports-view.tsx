'use client';

import {
  BarChart3,
  Beaker,
  CalendarCheck2,
  ChartLine,
  ClipboardList,
  FlaskConical,
  Package,
  Sigma,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { BarChart } from '@/components/charts/bar-chart';
import { C } from '@/components/charts/theme';
import { TrendChart } from '@/components/charts/trend-chart';
import { StatCard } from '@/components/data/stat-card';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { MonthNav } from '@/components/date/date-nav';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/tabs';
import { fmtCompact, fmtDate, fmtDay, fmtMoney0, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { REPORTS } from '../nav';
import { usePlant } from '../plant-context';
import {
  ExportButtons,
  ReportTableCard,
  useParamOptions,
  useRangeState,
  useReport,
  useStockItems,
  type Query,
} from './report-kit';

type Slug = (typeof REPORTS)[number]['slug'];
const META: Record<Slug, { icon: LucideIcon; text: string }> = {
  monthly: { icon: BarChart3, text: 'Daily values and running totals of up to 4 parameters for one month.' },
  custom: { icon: Sigma, text: 'Totals, averages, stock movement and revenue for any period.' },
  trend: { icon: ChartLine, text: 'One parameter day by day against its standard, with events.' },
  'stock-ledger': { icon: Package, text: 'Opening, received, consumed, adjustments and closing; days of stock left.' },
  'cash-book': { icon: Wallet, text: 'Site cash in, out and in hand, with descriptions.' },
  'lab-compliance': { icon: FlaskConical, text: 'Every lab result outside its limit, by parameter.' },
  submissions: { icon: CalendarCheck2, text: 'Who submitted each day’s logsheet and which days are missing.' },
};

/** Header shared by the 7 reports: title, report switcher, filters and Excel/PDF. */
function Shell({
  slug,
  filters,
  query,
  ready = true,
  children,
}: {
  slug: Slug;
  filters: ReactNode;
  query: Query;
  ready?: boolean;
  children: ReactNode;
}) {
  const { plant } = usePlant();
  const r = REPORTS.find((x) => x.slug === slug)!;
  return (
    <>
      <PageHeader
        title={r.label}
        subtitle={`${plant.name} · ${META[slug].text}`}
        crumbs={[{ label: 'Reports', href: `/plants/${plant.id}/reports` }, { label: r.label }]}
        actions={<ExportButtons slug={slug} query={query} disabled={!ready} />}
      />
      <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
        {REPORTS.map((x) => (
          <Link
            key={x.slug}
            href={`/plants/${plant.id}/reports/${x.slug}`}
            className={cn(
              'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors',
              x.slug === slug
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-line bg-surface text-ink-700 hover:border-ink-300',
            )}
          >
            {x.label}
          </Link>
        ))}
      </div>
      <Card padded={false} className="mb-6 flex flex-wrap items-center gap-3 p-4">
        {filters}
      </Card>
      <div className="space-y-6">{children}</div>
    </>
  );
}

/** Shown instead of an endless skeleton while a required filter is still empty. */
function PickFirst({ text }: { text: string }) {
  return (
    <Card>
      <EmptyState compact icon={<ClipboardList />} title={text} />
    </Card>
  );
}

const num = (v: unknown) => (typeof v === 'number' ? v : v === null || v === undefined || v === '' ? null : Number(v));

// ---------------------------------------------------------------- RPT-01…03 monthly
function Monthly() {
  const { get, set, max, min } = useRangeState();
  const opts = useParamOptions('sum');
  const month = get('month') ?? max.slice(0, 7);
  const params = (
    get('params') ??
    opts
      .slice(0, 2)
      .map((o) => o.value)
      .join(',')
  )
    .split(',')
    .filter(Boolean)
    .slice(0, 4);
  const query = { month, params: params.join(',') };
  const q = useReport('monthly', query, params.length > 0);
  const toggle = (code: string) => {
    const next = params.includes(code) ? params.filter((p) => p !== code) : [...params, code].slice(-4);
    set({ params: next.join(',') });
  };
  const first = params[0];
  const colours = [C.brand, C.purple, C.teal, C.warning];
  return (
    <Shell
      slug="monthly"
      query={query}
      ready={params.length > 0}
      filters={
        <>
          <MonthNav value={month} onChange={(m) => set({ month: m })} min={min} max={max} />
          <div className="flex flex-wrap gap-1.5">
            {opts.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                  params.includes(o.value)
                    ? 'border-brand-500 bg-brand-50 text-brand-600'
                    : 'border-line text-ink-600 hover:border-ink-300',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <span className="text-ink-400 text-xs">up to 4</span>
        </>
      }
    >
      {q.data && first && (
        <Card>
          <CardHeader
            title="Running total"
            subtitle="Cumulative over the month (days without data keep the total flat)"
          />
          <TrendChart
            data={q.data.rows}
            xKey="date"
            xFormat={(d) => String(Number(String(d).slice(8)))}
            height={260}
            series={params.map((p, i) => ({
              key: `${p}_cum`,
              label: opts.find((o) => o.value === p)?.label ?? p,
              color: colours[i],
              fill: i === 0,
            }))}
          />
        </Card>
      )}
      {params.length > 0 ? (
        <ReportTableCard table={q.data} loading={q.isFetching} error={q.error} />
      ) : (
        <PickFirst text={opts.length ? 'Pick at least one parameter' : 'Loading parameters…'} />
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- RPT-04…06 custom
function Custom() {
  const { range, setRange, min, max, get, set } = useRangeState(30);
  const { can } = usePlant();
  const opts = useParamOptions('any');
  const picked = (get('params') ?? '').split(',').filter(Boolean);
  // no pick = the API's default set of key parameters
  const query = { from: range.from, to: range.to, params: picked.length ? picked.join(',') : undefined };
  const q = useReport('custom', query);
  const toggle = (code: string) =>
    set({
      params: (picked.includes(code) ? picked.filter((p) => p !== code) : [...picked, code]).join(',') || undefined,
    });
  const showRevenue = can('revenue.view');
  const meta = (q.data?.meta ?? {}) as { calendarDays?: number; dataDays?: number };
  const rev = (label: string) => num(q.data?.rows.find((r) => String(r.item).startsWith(label))?.value);
  return (
    <Shell
      slug="custom"
      query={query}
      filters={
        <>
          <DateRangePicker value={range} onChange={setRange} min={min} max={max} />
          <Select
            className="w-[260px]"
            size="sm"
            aria-label="Add a parameter"
            value={undefined}
            placeholder={picked.length ? `+ Add parameter (${picked.length} chosen)` : '+ Add parameter (default set)'}
            onValueChange={toggle}
            options={opts
              .filter((o) => !picked.includes(o.value))
              .map((o) => ({ value: o.value, label: o.label, hint: o.unit }))}
          />
          {picked.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className="border-brand-500 bg-brand-50 text-brand-600 h-8 rounded-full border px-3 text-xs font-medium"
            >
              {opts.find((o) => o.value === c)?.label ?? c} ✕
            </button>
          ))}
        </>
      }
    >
      <div className={cn('grid gap-6 sm:grid-cols-2', showRevenue && 'xl:grid-cols-4')}>
        <StatCard
          title="Days in period"
          value={meta.calendarDays ?? null}
          loading={!q.data}
          caption={`${fmtDate(range.from)} → ${fmtDate(range.to)}`}
        />
        <StatCard title="Days with data" value={meta.dataDays ?? null} loading={!q.data} iconTone="success" />
        {showRevenue && (
          <>
            <StatCard
              title="Revenue (standard)"
              value={(rev('Revenue STD') ?? 0) * 1e6}
              format={(v) => fmtMoney0(v)}
              loading={!q.data}
            />
            <StatCard
              title="Revenue (actual)"
              value={(rev('Revenue ACT') ?? 0) * 1e6}
              format={(v) => fmtMoney0(v)}
              loading={!q.data}
              iconTone="purple"
            />
          </>
        )}
      </div>
      <ReportTableCard table={q.data} loading={q.isFetching} error={q.error} />
    </Shell>
  );
}

// ---------------------------------------------------------------- RPT-07 trend
function Trend() {
  const { range, setRange, min, max, get, set } = useRangeState(60);
  const opts = useParamOptions('any');
  const param = get('param') ?? opts[0]?.value;
  const query = { param, from: range.from, to: range.to };
  const q = useReport('trend', query, !!param);
  const rows = q.data?.rows ?? [];
  const vals = rows.map((r) => num(r.value)).filter((v): v is number => v !== null);
  const avg = vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
  const events = rows.filter((r) => r.event === 'YES').length;
  const std = num(rows.at(-1)?.std);
  return (
    <Shell
      slug="trend"
      query={query}
      filters={
        <>
          <Select
            className="w-[220px]"
            value={param}
            onValueChange={(v) => set({ param: v })}
            options={opts.map((o) => ({ value: o.value, label: o.label, hint: o.unit }))}
          />
          <DateRangePicker value={range} onChange={setRange} min={min} max={max} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Average" value={avg} format={(v) => fmtNum(v, 2)} loading={!q.data} />
        <StatCard
          title="Latest standard"
          value={std}
          format={(v) => fmtNum(v, 2)}
          loading={!q.data}
          iconTone="purple"
        />
        <StatCard
          title="Events"
          value={events}
          loading={!q.data}
          iconTone={events ? 'danger' : 'success'}
          caption="days outside the standard"
        />
      </div>
      <Card>
        <CardHeader title={q.data?.title ?? 'Trend'} subtitle={q.data?.subtitle} />
        <TrendChart
          data={rows}
          xKey="date"
          xFormat={(d) => fmtDay(String(d))}
          height={300}
          series={[
            { key: 'value', label: 'Value', color: C.brand, fill: true },
            { key: 'std', label: 'Standard', color: C.danger, dashed: true },
            { key: 'min', label: 'Lower limit', color: C.teal, dashed: true },
            { key: 'max', label: 'Upper limit', color: C.warning, dashed: true },
          ]}
        />
      </Card>
      {param ? (
        <ReportTableCard table={q.data} loading={q.isFetching} error={q.error} />
      ) : (
        <PickFirst text="Loading parameters…" />
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- RPT-08/09 stock ledger
function StockLedger() {
  const { range, setRange, min, max, get, set } = useRangeState(30);
  const items = useStockItems();
  const item = get('item') ?? items[0]?.value;
  const query = { item, from: range.from, to: range.to };
  const q = useReport('stock-ledger', query, !!item);
  const meta = (q.data?.meta ?? {}) as { daysOfStockLeft?: number | null; avgDailyConsumption?: number };
  const last = q.data?.rows.at(-1);
  const left = meta.daysOfStockLeft ?? null;
  return (
    <Shell
      slug="stock-ledger"
      query={query}
      filters={
        <>
          <Segmented
            value={item}
            onChange={(v) => set({ item: v })}
            items={items.map((i) => ({ value: i.value, label: i.label }))}
            size="sm"
          />
          <DateRangePicker value={range} onChange={setRange} min={min} max={max} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Closing stock" value={num(last?.closing)} format={(v) => fmtNum(v, 2)} loading={!q.data} />
        <StatCard
          title="Average use / day"
          value={meta.avgDailyConsumption ?? null}
          format={(v) => fmtNum(v, 2)}
          loading={!q.data}
          caption="last 30 days with data"
        />
        <StatCard
          title="Days of stock left"
          value={left}
          format={(v) => fmtNum(v, 0)}
          loading={!q.data}
          iconTone={left !== null && left < 7 ? 'danger' : left !== null && left < 15 ? 'warning' : 'success'}
        />
      </div>
      <Card>
        <CardHeader title="Closing balance" subtitle={q.data?.subtitle} />
        <TrendChart
          data={q.data?.rows ?? []}
          xKey="date"
          xFormat={(d) => fmtDay(String(d))}
          height={240}
          series={[
            { key: 'closing', label: 'Closing', color: C.brand, fill: true },
            { key: 'consumed', label: 'Consumed', color: C.warning },
          ]}
        />
      </Card>
      {item ? (
        <ReportTableCard table={q.data} loading={q.isFetching} error={q.error} />
      ) : (
        <PickFirst text="No stock items are linked on this plant (Settings → Stock)" />
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------- RPT-10 cash book
function CashBook() {
  const { range, setRange, min, max } = useRangeState(30);
  const query = { from: range.from, to: range.to };
  const q = useReport('cash-book', query);
  const f = q.data?.footer?.[0];
  return (
    <Shell
      slug="cash-book"
      query={query}
      filters={<DateRangePicker value={range} onChange={setRange} min={min} max={max} />}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Received" value={num(f?.received)} format={fmtMoney0} loading={!q.data} iconTone="success" />
        <StatCard title="Spent" value={num(f?.expense)} format={fmtMoney0} loading={!q.data} iconTone="warning" />
        <StatCard
          title="In hand at the end"
          value={num(q.data?.rows.at(-1)?.closing)}
          format={fmtMoney0}
          loading={!q.data}
        />
      </div>
      <Card>
        <CardHeader title="Daily expenses" subtitle={q.data?.subtitle} />
        <BarChart
          height={220}
          highlight="max"
          seriesLabel="Expense"
          format={(v) => fmtCompact(v, { money: true })}
          data={(q.data?.rows ?? []).map((r) => ({ label: fmtDay(String(r.date)), value: num(r.expense) }))}
        />
      </Card>
      <ReportTableCard table={q.data} loading={q.isFetching} error={q.error} />
    </Shell>
  );
}

// ---------------------------------------------------------------- RPT-11 lab compliance
function LabCompliance() {
  const { range, setRange, min, max, get, set } = useRangeState(90);
  const side = (get('side') as 'outlet' | 'inlet' | 'both' | undefined) ?? 'outlet';
  const query = { side, from: range.from, to: range.to };
  const q = useReport('lab-compliance', query);
  const summary = ((q.data?.meta ?? {}) as { summary?: Record<string, number> }).summary ?? {};
  const bars = Object.entries(summary).map(([label, value]) => ({ label, value }));
  return (
    <Shell
      slug="lab-compliance"
      query={query}
      filters={
        <>
          <Segmented
            size="sm"
            value={side}
            onChange={(v) => set({ side: v })}
            items={[
              { value: 'outlet', label: 'Outlet' },
              { value: 'inlet', label: 'Inlet' },
              { value: 'both', label: 'Both' },
            ]}
          />
          <DateRangePicker value={range} onChange={setRange} min={min} max={max} />
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <StatCard
          title="Exceedances"
          icon={<Beaker />}
          value={q.data?.rows.length ?? null}
          loading={!q.data}
          iconTone={(q.data?.rows.length ?? 0) > 0 ? 'danger' : 'success'}
          caption={(q.data?.rows.length ?? 0) > 0 ? 'results outside their limit' : 'every result within its limit'}
        />
        <Card>
          <CardHeader title="By parameter" />
          {bars.length ? (
            <BarChart
              height={180}
              highlight="max"
              seriesLabel="Exceedances"
              color={C.danger}
              format={(v) => fmtNum(v, 0)}
              data={bars}
            />
          ) : (
            <p className="text-ink-500 py-10 text-center text-sm">No exceedance in this period.</p>
          )}
        </Card>
      </div>
      <ReportTableCard table={q.data} loading={q.isFetching} error={q.error} />
    </Shell>
  );
}

// ---------------------------------------------------------------- RPT-12 submissions
function Submissions() {
  const { range, setRange, min, max } = useRangeState(30);
  const query = { from: range.from, to: range.to };
  const q = useReport('submissions', query);
  const rows = q.data?.rows ?? [];
  // the API sends corrected days as "corrected v2" → compare the first word only
  const count = (s: string[]) => rows.filter((r) => s.includes(String(r.status).split(' ')[0] ?? '')).length;
  const done = count(['submitted', 'corrected', 'checked', 'verified']);
  const missing = ((q.data?.meta ?? {}) as { missing?: number }).missing ?? count(['missing']);
  return (
    <Shell
      slug="submissions"
      query={query}
      filters={<DateRangePicker value={range} onChange={setRange} min={min} max={max} />}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Submitted"
          value={done}
          loading={!q.data}
          iconTone="success"
          caption={`of ${rows.length} days`}
        />
        <StatCard title="Missing" value={missing} loading={!q.data} iconTone="danger" />
        <StatCard title="Drafts" value={count(['draft'])} loading={!q.data} iconTone="warning" />
        <StatCard
          title="Returned"
          value={count(['returned'])}
          loading={!q.data}
          iconTone="purple"
          caption="sent back by the checker"
        />
      </div>
      <ReportTableCard table={q.data} loading={q.isFetching} error={q.error} />
    </Shell>
  );
}

const VIEWS: Record<Slug, () => ReactNode> = {
  monthly: () => <Monthly />,
  custom: () => <Custom />,
  trend: () => <Trend />,
  'stock-ledger': () => <StockLedger />,
  'cash-book': () => <CashBook />,
  'lab-compliance': () => <LabCompliance />,
  submissions: () => <Submissions />,
};

function ReportsIndex() {
  const { plant } = usePlant();
  return (
    <>
      <PageHeader title="Reports" subtitle={`${plant.name} · every report exports to Excel and PDF`} />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r, i) => {
          const m = META[r.slug];
          return (
            <motion.div
              key={r.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/plants/${plant.id}/reports/${r.slug}`} className="block h-full">
                <Card interactive className="h-full">
                  <span className="bg-brand-50 text-brand-500 grid size-11 place-items-center rounded-2xl">
                    <m.icon className="size-5" />
                  </span>
                  <p className="text-ink-900 mt-4 text-base font-semibold">{r.label}</p>
                  <p className="text-ink-500 mt-1 text-sm">{m.text}</p>
                </Card>
              </Link>
            </motion.div>
          );
        })}
        <Link href={`/plants/${plant.id}/logsheet`} className="block">
          <Card interactive className="h-full border-dashed">
            <span className="bg-muted-bg text-ink-500 grid size-11 place-items-center rounded-2xl">
              <ClipboardList className="size-5" />
            </span>
            <p className="text-ink-900 mt-4 text-base font-semibold">Logsheet calendar</p>
            <p className="text-ink-500 mt-1 text-sm">Open or fill a day’s logsheet.</p>
          </Card>
        </Link>
      </div>
    </>
  );
}

/** /plants/:id/reports and /plants/:id/reports/:slug (PRD §16, RPT-01…12). */
export function ReportsView() {
  const params = useParams<{ slug?: string[] }>();
  const slug = params.slug?.[0];
  if (!slug) return <ReportsIndex />;
  const view = VIEWS[slug as Slug];
  if (!view || (params.slug?.length ?? 0) > 1) notFound();
  return <>{view()}</>;
}
