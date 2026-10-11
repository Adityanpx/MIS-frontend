'use client';

import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  FilePenLine,
  FileSpreadsheet,
  PencilLine,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Donut } from '@/components/charts/donut';
import { C } from '@/components/charts/theme';
import { StatCard } from '@/components/data/stat-card';
import { MonthNav } from '@/components/date/date-nav';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, ProgressBar, Skeleton } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/popover';
import { errorMessage } from '@/lib/api';
import { todayIST } from '@/lib/dates';
import { fmtDate, fmtDateTime, fmtDay, fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { weekday } from '../engine-ui';
import { usePlantDate } from '../plant-date';
import { usePlant } from '../plant-context';
import { useLogCalendar } from './queries';
import { BLOCK_REASON_TEXT, type CalendarDay, type DayStatus } from './types';

export const DAY_STYLE: Record<DayStatus, { tile: string; dot: string; label: string }> = {
  submitted: {
    tile: 'border-success-100 bg-success-50/70 hover:border-success-400',
    dot: 'bg-success-500',
    label: 'Submitted',
  },
  corrected: { tile: 'border-teal-500/25 bg-teal-50 hover:border-teal-500/60', dot: 'bg-teal-500', label: 'Corrected' },
  checked: { tile: 'border-brand-100 bg-brand-50 hover:border-brand-300', dot: 'bg-brand-500', label: 'Checked' },
  verified: {
    tile: 'border-purple-500/20 bg-purple-50 hover:border-purple-500/50',
    dot: 'bg-purple-500',
    label: 'Verified',
  },
  returned: { tile: 'border-danger-100 bg-danger-50 hover:border-danger-500', dot: 'bg-danger-500', label: 'Returned' },
  draft: { tile: 'border-warning-100 bg-warning-50 hover:border-warning-500', dot: 'bg-warning-500', label: 'Draft' },
  missing: {
    tile: 'border-dashed border-danger-500/45 bg-surface hover:bg-danger-50/60',
    dot: 'bg-danger-500',
    label: 'Missing',
  },
  future: { tile: 'border-line bg-canvas/60 text-ink-300', dot: 'bg-ink-200', label: 'Not open' },
  not_allowed: { tile: 'border-line bg-canvas/60 text-ink-300 dot-grid', dot: 'bg-ink-200', label: 'Closed' },
};
const DONE: DayStatus[] = ['submitted', 'corrected', 'checked', 'verified'];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DayTile({ d, href, today }: { d: CalendarDay; href: string | null; today: boolean }) {
  const s = DAY_STYLE[d.status];
  const n = Number(d.date.slice(8));
  const body = (
    <div
      className={cn(
        'rounded-inner group relative flex h-full min-h-[76px] flex-col justify-between border p-2 transition-[border-color,background,box-shadow,transform] duration-200 sm:min-h-[92px] sm:p-2.5',
        s.tile,
        href && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(16_24_40/0.06)]',
        today && 'ring-brand-500 ring-2 ring-offset-2',
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn('tabular text-sm font-semibold sm:text-base', href ? 'text-ink-900' : 'text-ink-400')}>
          {n}
        </span>
        {DONE.includes(d.status) && <CheckCircle2 className="text-success-600 size-4 opacity-80" />}
        {d.status === 'draft' && <PencilLine className="text-warning-500 size-4" />}
        {d.status === 'missing' && <AlertCircle className="text-danger-500 size-4" />}
      </div>
      <div className="min-w-0">
        <span className="hidden items-center gap-1.5 text-[11px] font-semibold sm:inline-flex">
          <span className={cn('size-1.5 rounded-full', s.dot)} />
          <span className={cn(d.status === 'future' || d.status === 'not_allowed' ? 'text-ink-400' : 'text-ink-700')}>
            {s.label}
          </span>
        </span>
        {d.submittedBy && <p className="text-ink-500 hidden truncate text-[10px] xl:block">{d.submittedBy}</p>}
        <span className={cn('block size-1.5 rounded-full sm:hidden', s.dot)} />
      </div>
    </div>
  );
  const tip =
    d.reason && !DONE.includes(d.status)
      ? BLOCK_REASON_TEXT[d.reason]?.title
      : d.submittedAt
        ? `${s.label} by ${d.submittedBy ?? '—'} · ${fmtDateTime(d.submittedAt)}`
        : `${weekday(d.date)} ${fmtDate(d.date)} · ${s.label}`;
  return (
    <Tooltip content={tip}>
      {href ? (
        <Link href={href} aria-label={`${fmtDate(d.date)} — ${s.label}`} className="block h-full">
          {body}
        </Link>
      ) : (
        <div aria-label={`${fmtDate(d.date)} — ${s.label}`} className="h-full">
          {body}
        </div>
      )}
    </Tooltip>
  );
}

/** The logsheet month: who submitted what, what is missing, and where to continue (LOG-01/02). */
export function LogsheetCalendar() {
  const { plant, can } = usePlant();
  const pd = usePlantDate('logsheet');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const fallback = (pd.max < plant.misStart ? plant.misStart : pd.max).slice(0, 7);
  const qMonth = sp.get('month');
  const month = qMonth && /^\d{4}-\d{2}$/.test(qMonth) ? qMonth : fallback;
  const q = useLogCalendar(plant.id, month);
  const today = todayIST();

  const setMonth = (m: string) => router.replace(`${pathname}?month=${m}`, { scroll: false });

  const stats = useMemo(() => {
    const days = q.data?.days ?? [];
    const count = (st: DayStatus[]) => days.filter((d) => st.includes(d.status)).length;
    const done = count(DONE);
    const missing = count(['missing']);
    const drafts = count(['draft']);
    const due = done + missing + drafts + count(['returned']);
    return { done, missing, drafts, due, corrected: count(['corrected']), pct: due ? done / due : 0 };
  }, [q.data]);

  const attention = (q.data?.days ?? []).filter(
    (d) => d.status === 'missing' || d.status === 'draft' || d.status === 'returned',
  );
  const continueDay = attention.find((d) => d.status === 'draft') ?? attention.at(-1);
  const lead = q.data ? (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7 : 0;

  return (
    <>
      <PageHeader
        title="Daily logsheet"
        subtitle={`${plant.name} · one logsheet per day, saved as you type`}
        actions={
          <>
            <MonthNav value={month} onChange={setMonth} min={plant.misStart} max={pd.max} />
            {can('imports.manage') && (
              <Button variant="secondary" asChild>
                <Link href={`/plants/${plant.id}/imports`}>
                  <FileSpreadsheet /> Import Excel
                </Link>
              </Button>
            )}
            {continueDay && can('logsheet.edit') && (
              <Button asChild>
                <Link href={pd.hrefFor('logsheet', continueDay.date)}>
                  <FilePenLine />
                  {continueDay.status === 'draft' ? 'Continue' : 'Fill'} {fmtDay(continueDay.date)}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Submitted"
          icon={<CalendarCheck2 />}
          iconTone="success"
          value={stats.done}
          loading={q.isLoading}
          caption={`of ${stats.due} days due this month`}
        />
        <StatCard
          title="Missing"
          icon={<AlertCircle />}
          iconTone="danger"
          value={stats.missing}
          loading={q.isLoading}
          caption={stats.missing ? 'days without a logsheet' : 'nothing missing — well done'}
        />
        <StatCard
          title="Drafts"
          icon={<PencilLine />}
          iconTone="warning"
          value={stats.drafts}
          loading={q.isLoading}
          caption="started, not submitted yet"
        />
        <StatCard
          title="Completion"
          icon={<CheckCircle2 />}
          value={stats.pct * 100}
          format={(n) => fmtPct(n, 0)}
          loading={q.isLoading}
          footer={
            <ProgressBar
              value={stats.done}
              max={Math.max(stats.due, 1)}
              tone={stats.pct >= 1 ? 'success' : 'brand'}
              height={6}
            />
          }
        />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader
            title="Month at a glance"
            subtitle="Click a day to open its logsheet"
            action={
              <div className="hidden flex-wrap gap-3 md:flex">
                {(['submitted', 'corrected', 'draft', 'missing', 'future'] as DayStatus[]).map((st) => (
                  <span key={st} className="text-ink-500 inline-flex items-center gap-1.5 text-xs">
                    <span className={cn('size-2 rounded-full', DAY_STYLE[st].dot)} />
                    {DAY_STYLE[st].label}
                  </span>
                ))}
              </div>
            }
          />
          {q.isError ? (
            <EmptyState
              icon={<AlertCircle />}
              title="Could not load the calendar"
              description={errorMessage(q.error)}
            />
          ) : (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
              {WEEK.map((w) => (
                <div key={w} className="text-ink-400 pb-1 text-center text-[11px] font-medium tracking-wider uppercase">
                  {w}
                </div>
              ))}
              {q.isLoading ? (
                Array.from({ length: 35 }, (_, i) => (
                  <Skeleton key={i} className="rounded-inner h-[76px] sm:h-[92px]" />
                ))
              ) : (
                <>
                  {Array.from({ length: lead }, (_, i) => (
                    <div key={`e${i}`} />
                  ))}
                  {q.data!.days.map((d, i) => {
                    const open = d.status !== 'future' && d.status !== 'not_allowed';
                    return (
                      <motion.div
                        key={d.date}
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: i * 0.012 }}
                      >
                        <DayTile d={d} today={d.date === today} href={open ? pd.hrefFor('logsheet', d.date) : null} />
                      </motion.div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="This month" subtitle={`${stats.done} of ${stats.due} days complete`} />
            {q.isLoading ? (
              <Skeleton className="mx-auto size-[170px] rounded-full" />
            ) : (
              <Donut
                size={170}
                legend={false}
                centre={fmtPct(stats.pct * 100, 0)}
                centreLabel="complete"
                data={[
                  { label: 'Submitted', value: stats.done - stats.corrected, color: C.success },
                  { label: 'Corrected', value: stats.corrected, color: C.teal },
                  { label: 'Draft', value: stats.drafts, color: C.warning },
                  { label: 'Missing', value: stats.missing, color: C.danger },
                ].filter((x) => x.value > 0)}
              />
            )}
          </Card>
          <Card>
            <CardHeader
              title="Needs attention"
              subtitle={attention.length ? `${attention.length} day(s)` : 'All caught up'}
            />
            {attention.length === 0 ? (
              <EmptyState
                compact
                icon={<CheckCircle2 />}
                title="Nothing pending"
                description="Every open day of this month has a logsheet."
              />
            ) : (
              <ul className="space-y-1.5">
                {attention.slice(0, 8).map((d) => (
                  <li key={d.date}>
                    <Link
                      href={pd.hrefFor('logsheet', d.date)}
                      className="hover:bg-canvas group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors"
                    >
                      <span className={cn('size-2 rounded-full', DAY_STYLE[d.status].dot)} />
                      <span className="text-ink-900 tabular flex-1 text-[13px] font-medium">
                        {weekday(d.date)} {fmtDate(d.date)}
                      </span>
                      <span className="text-ink-500 text-xs">{DAY_STYLE[d.status].label}</span>
                      <ChevronRight className="text-ink-300 group-hover:text-ink-700 size-4 transition-colors" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
