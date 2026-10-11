'use client';

import { ArrowRight, CheckCircle2, ClipboardList, Clock, Gauge, Settings2, Table2 } from 'lucide-react';
import Link from 'next/link';
import { Sparkline } from '@/components/charts/sparkline';
import { C } from '@/components/charts/theme';
import { CountUp } from '@/components/motion/count-up';
import { DeltaPill, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/misc';
import { fmtDate, fmtDay, fmtNum, fmtPct } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { AlertItem, alertHref } from '../dashboard/parts';
import type { OverviewPlant } from '../engine-types';
import { badgeDelta, fmtUnitValue, unitLabel } from '../engine-ui';

const EXPECTED: Record<OverviewPlant['expected']['status'], { label: string; cls: string; Icon: typeof CheckCircle2 }> =
  {
    submitted: { label: 'Submitted', cls: 'bg-success-50 text-success-600', Icon: CheckCircle2 },
    corrected: { label: 'Submitted (corrected)', cls: 'bg-success-50 text-success-600', Icon: CheckCircle2 },
    checked: { label: 'Checked', cls: 'bg-success-50 text-success-600', Icon: CheckCircle2 },
    verified: { label: 'Verified', cls: 'bg-success-50 text-success-600', Icon: CheckCircle2 },
    returned: { label: 'Returned', cls: 'bg-danger-50 text-danger-600', Icon: ClipboardList },
    draft: { label: 'Draft — not submitted', cls: 'bg-warning-50 text-warning-600', Icon: Clock },
    missing: { label: 'Pending', cls: 'bg-danger-50 text-danger-600', Icon: Clock },
    not_due: { label: 'Not due', cls: 'bg-muted-bg text-ink-500', Icon: Clock },
  };

function Tile({ code }: { code: string }) {
  return (
    <span className="bg-brand-50 text-brand-500 grid size-11 shrink-0 place-items-center rounded-2xl text-xs font-bold tracking-wide">
      {code.slice(0, 3)}
    </span>
  );
}

/** PRD CA-01 plant card: status, yesterday's logsheet, headline KPI with sparkline, compliance, submissions, alerts. */
export function PlantCard({ p }: { p: OverviewPlant }) {
  const base = `/plants/${p.plantId}`;
  const pending = p.setupStatus === 'settings_pending';
  const exp = EXPECTED[p.expected.status];
  const comp = p.compliance?.mtdPct ?? null;

  return (
    <Card className="hover:shadow-float flex h-full flex-col transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <Tile code={p.code} />
        <div className="min-w-0 flex-1">
          <Link
            href={pending ? `${base}/settings` : `${base}/dashboard`}
            className="text-ink-900 hover:text-brand-600 block truncate text-[15px] font-semibold"
          >
            {p.name}
          </Link>
          <p className="text-ink-500 truncate text-xs">
            {p.type} · {fmtNum(p.capacityMld)} MLD{p.city && ` · ${p.city}`} · {ROLE_LABEL[p.myRole] ?? p.myRole}
          </p>
        </div>
        <StatusBadge
          status={pending ? 'settings_pending' : p.setupStatus === 'closed' ? 'closed' : p.accountState}
          size="sm"
        />
      </div>

      {pending ? (
        <div className="rounded-inner mt-5 flex flex-1 flex-col items-start justify-between gap-4 bg-purple-50 p-4">
          <div>
            <p className="text-ink-900 text-sm font-semibold">Setup in progress</p>
            <p className="text-ink-500 mt-1 text-xs">
              Parameters, standards, stock and contract fees must be completed before the first logsheet.
            </p>
          </div>
          {p.myRole === 'client_admin' && (
            <Button asChild size="sm">
              <Link href={`${base}/settings`}>
                <Settings2 />
                Continue setup
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap',
                exp.cls,
              )}
            >
              <exp.Icon className="size-3.5" />
              {fmtDay(p.expected.date)} · {exp.label}
            </span>
            {p.reportDate && <span className="text-ink-400 text-[11px]">data to {fmtDate(p.reportDate)}</span>}
          </div>

          {p.primary ? (
            <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
              <div className="min-w-0">
                <p className="text-ink-500 truncate text-xs font-medium">{p.primary.name}, latest day</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-ink-900 text-[28px] leading-none font-semibold tracking-tight">
                    <CountUp
                      value={p.primary.today}
                      format={(n) => fmtUnitValue(n, p.primary!.unit, p.primary!.decimals)}
                    />
                  </span>
                  <span className="text-ink-500 text-xs">{unitLabel(p.primary.unit)}</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <DeltaPill {...(badgeDelta(p.primary.badge) ?? { value: null })} />
                  <span className="text-ink-500 truncate text-[11px]">
                    MTD avg {fmtUnitValue(p.primary.mtdAvg, p.primary.unit, p.primary.decimals)}/day
                  </span>
                </div>
              </div>
              <div className="w-28">
                <Sparkline
                  values={p.spark.map((s) => s.value)}
                  height={48}
                  color={p.primary.badge.colour === 'red' ? C.danger : C.brand}
                />
              </div>
            </div>
          ) : (
            <p className="rounded-inner bg-canvas text-ink-500 mt-4 px-4 py-3 text-xs">No submitted logsheet yet.</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="text-ink-500 flex justify-between text-[11px]">
                <span>Compliance</span>
                <span className="text-ink-900 tabular font-semibold">{comp === null ? '—' : fmtPct(comp, 1)}</span>
              </div>
              <ProgressBar
                className="mt-1.5"
                value={comp ?? 0}
                max={100}
                tone={comp === null ? 'brand' : comp >= 95 ? 'success' : comp >= 85 ? 'warning' : 'danger'}
                height={6}
              />
            </div>
            <div>
              <div className="text-ink-500 flex justify-between text-[11px]">
                <span>Logsheets, 30 days</span>
                <span className="text-ink-900 tabular font-semibold">
                  {p.submissions30d.submitted}/{p.submissions30d.days}
                </span>
              </div>
              <ProgressBar
                className="mt-1.5"
                value={p.submissions30d.submitted}
                max={p.submissions30d.days || 1}
                tone={p.submissions30d.submitted < p.submissions30d.days ? 'warning' : 'success'}
                height={6}
              />
            </div>
          </div>

          {p.alerts.length > 0 && (
            <ul className="-mx-2 mt-3 space-y-0.5">
              {p.alerts.slice(0, 2).map((a, i) => (
                <AlertItem
                  key={a.id}
                  alert={a}
                  index={i}
                  href={p.reportDate ? alertHref(p.plantId, p.reportDate, a) : undefined}
                />
              ))}
              {p.alerts.length > 2 && (
                <li className="text-ink-500 px-2 pt-1 text-xs font-medium">
                  +{p.alerts.length - 2} more on the dashboard
                </li>
              )}
            </ul>
          )}

          <div className="border-line mt-auto flex flex-wrap gap-2 border-t border-dashed pt-4">
            <Button asChild size="sm">
              <Link href={`${base}/dashboard`}>
                <Gauge />
                Dashboard
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={`${base}/mis`}>
                <Table2 />
                MIS
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href={`${base}/logsheet`}>
                Logsheet
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
