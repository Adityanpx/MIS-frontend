'use client';

import { Banknote, Download, FlaskConical, Gauge, HardHat, Package, Printer, ShieldCheck, Table2, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/tabs';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { isValidISODate } from '@/lib/dates';
import { fmtDate, fmtDateTime, fmtMoney0 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMis } from '../engine-queries';
import type { MisReport } from '../engine-types';
import { usePlantPdf } from '../pdf';
import { usePlantDate } from '../plant-date';
import { usePlant } from '../plant-context';
import {
  LabTable,
  RegistersTable,
  SafetyTable,
  SimpleParamTable,
  StaffTable,
  type MisKind,
  type MisPeriod,
} from './mis-tables';

const KINDS: { value: MisKind; label: string }[] = [
  { value: 'actual', label: 'Actual' },
  { value: 'bidding', label: 'Bidding' },
  { value: 'both', label: 'Both' },
];
const KIND_NAME: Record<MisKind, string> = {
  actual: 'Actual standard',
  bidding: 'Bidding standard',
  both: 'Actual & Bidding standards',
};
const PERIOD_NAME: Record<MisPeriod, string> = {
  today: 'Daily',
  mtd: 'Monthly',
  utd: 'Up to date',
  range: 'Date range',
  all: 'Daily · Monthly · UTD',
};

function Block({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader title={title} icon={icon} />
      {children}
    </Card>
  );
}

function CashBlock({ cash }: { cash: MisReport['cash'] }) {
  const c = cash;
  const low = c.inHand !== null && c.alertLimit !== null && c.inHand < c.alertLimit;
  const tiles = [
    { label: 'Spent today', value: fmtMoney0(c.today) },
    { label: 'Received today', value: fmtMoney0(c.received) },
    { label: 'Spent this month', value: fmtMoney0(c.mtd) },
    { label: 'Spent since MIS start', value: fmtMoney0(c.utd) },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
      <div className={cn('rounded-inner p-5', low || (c.inHand ?? 0) < 0 ? 'bg-danger-50' : 'bg-premium text-white')}>
        <p className={cn('text-xs font-medium', low ? 'text-danger-600' : 'text-brand-200')}>Cash in hand</p>
        <p className={cn('tabular mt-2 text-3xl font-bold tracking-tight', low ? 'text-danger-600' : 'text-white')}>
          {fmtMoney0(c.inHand)}
        </p>
        {c.alertLimit !== null && (
          <p className={cn('mt-2 text-xs', low ? 'text-danger-600' : 'text-brand-200')}>
            Alert below {fmtMoney0(c.alertLimit)}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-inner border-line border p-4">
            <p className="text-ink-500 text-xs">{t.label}</p>
            <p className="text-ink-900 tabular mt-1 text-lg font-semibold">{t.value}</p>
          </div>
        ))}
        {c.description && (
          <p className="rounded-inner bg-canvas text-ink-700 col-span-2 px-4 py-3 text-xs">
            <span className="font-medium">Today&apos;s expense:</span> {c.description}
          </p>
        )}
      </div>
    </div>
  );
}

/** The dates the report is for: one date, or "start – end". */
const dateText = (from: string, to: string) => (from === to ? fmtDate(to) : `${fmtDate(from)} – ${fmtDate(to)}`);

/**
 * /plants/[plantId]/mis/[[...date]]?from=
 * The MIS report: Daily / Monthly / UTD / Date range / All × Actual / Bidding / Both.
 * The path date is the end date; `from` (optional) makes it a range. The date pill shows exactly what is applied.
 */
export function MisView() {
  const { plant, can } = usePlant();
  const { date, min, max } = usePlantDate('mis');
  const router = useRouter();
  const sp = useSearchParams();
  const rawFrom = sp.get('from');
  const from = rawFrom && isValidISODate(rawFrom) && rawFrom < (date ?? max) ? rawFrom : null;
  const q = useMis(plant.id, date, from);
  const pdf = usePlantPdf(plant.id, can('pdf.generate'));
  const [pick, setPick] = useState<MisPeriod>('today');
  const [kind, setKind] = useState<MisKind>('actual');

  const m = q.data;
  const reportDate = m?.header.reportDate ?? date ?? max;
  // the range the server actually used (it never starts before the MIS start)
  const rangeFrom = from ? (m?.header.rangeFrom ?? from) : null;
  const hasRange = !!rangeFrom && rangeFrom < reportDate;
  const period: MisPeriod = pick === 'range' && !hasRange ? 'today' : pick;
  const appliedFrom = hasRange ? rangeFrom : reportDate;
  const t = m?.tabs;
  const key = t?.key ?? m?.keyParameters ?? [];
  const chemicals = t?.chemicals ?? m?.chemicals ?? [];
  const lab = t?.compliance.lab ?? m?.lab;
  const registers = t?.compliance.registers ?? m?.registers;
  const cash = t?.administrative.cash ?? m?.cash;
  const staff = t?.administrative.staff ?? m?.staff;
  const safety = t?.administrative.safety ?? m?.safety;
  const logsheet = m?.header.logsheet;
  const asOn = hasRange ? ` · as on ${fmtDate(reportDate)}` : '';
  const rangeLabel = hasRange ? dateText(appliedFrom, reportDate) : undefined;

  const go = (r: { from: string; to: string }) => {
    router.push(`/plants/${plant.id}/mis/${r.to}${r.from < r.to ? `?from=${r.from}` : ''}`, { scroll: false });
    if (r.from < r.to) setPick('range');
    else if (pick === 'range') setPick('today');
  };

  return (
    <>
      <PageHeader
        title="MIS report"
        subtitle={m ? `${m.header.plantName} · ${m.header.companyName}` : plant.name}
        actions={
          <>
            {m &&
              (logsheet ? (
                <StatusBadge status={logsheet.status} size="sm" />
              ) : (
                <Badge tone="warning" dot>
                  No logsheet
                </Badge>
              ))}
            <Button variant="secondary" className="no-print" disabled={!m} onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            <Button
              className="no-print"
              loading={pdf.busy}
              disabled={!m}
              onClick={() =>
                void pdf.download(reportDate, 'mis', { period, kind, from: hasRange ? appliedFrom : null })
              }
            >
              <Download />
              Download PDF
            </Button>
          </>
        }
      />

      <Card padded={false} className="no-print mb-6 flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <DateRangePicker
          className="w-full justify-between sm:w-auto"
          value={{ from: appliedFrom, to: reportDate }}
          onChange={go}
          min={min}
          max={max}
        />
        <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
          <Segmented
            items={[
              { value: 'today', label: 'Daily' },
              { value: 'mtd', label: 'Monthly' },
              { value: 'utd', label: 'UTD' },
              { value: 'range', label: 'Range', disabled: !hasRange },
              { value: 'all', label: 'All' },
            ]}
            value={period}
            onChange={setPick}
          />
        </div>
        <div className="scrollbar-none -mx-1 overflow-x-auto px-1">
          <Segmented items={KINDS} value={kind} onChange={setKind} />
        </div>
      </Card>

      {/* what a printed page shows in place of the filter bar */}
      <p className="mb-4 hidden text-sm font-semibold print:block">
        {dateText(appliedFrom, reportDate)} · {PERIOD_NAME[period]} · {KIND_NAME[kind]}
      </p>

      {q.isLoading && <Skeleton className="rounded-card h-[520px]" />}
      {q.isError && !m && (
        <Card>
          <EmptyState
            icon={<Table2 />}
            title="The MIS report could not be loaded"
            description={errorMessage(q.error)}
            action={<Button onClick={() => void q.refetch()}>Try again</Button>}
          />
        </Card>
      )}

      {m && (
        <div className={cn('space-y-6 transition-opacity duration-300', q.isPlaceholderData && 'opacity-60')}>
          <Block title="Key parameters" icon={<Gauge />}>
            <SimpleParamTable rows={key} period={period} kind={kind} hasRange={hasRange} rangeLabel={rangeLabel} />
          </Block>
          {chemicals.length > 0 && (
            <Block title="Chemicals" icon={<Package />}>
              <SimpleParamTable
                rows={chemicals}
                period={period}
                kind={kind}
                hasRange={hasRange}
                rangeLabel={rangeLabel}
                chemicals
              />
            </Block>
          )}
          {lab && (
            <Block title={`Quality control${asOn}`} icon={<FlaskConical />}>
              <p className="text-ink-400 mb-2 text-[11px] font-medium tracking-wider uppercase">Inlet</p>
              <LabTable rows={lab.inlet} v11={!!t} />
              <p className="text-ink-400 mt-6 mb-2 text-[11px] font-medium tracking-wider uppercase">Outlet</p>
              <LabTable rows={lab.outlet} v11={!!t} />
            </Block>
          )}
          {registers && (
            <Block title={`Bank guarantees & insurance${asOn}`} icon={<ShieldCheck />}>
              <RegistersTable registers={registers} />
            </Block>
          )}
          {cash && (
            <Block title={`Site cash${asOn}`} icon={<Banknote />}>
              <CashBlock cash={cash} />
            </Block>
          )}
          {(staff || safety) && (
            <div className={cn('grid gap-6', staff && safety && 'xl:grid-cols-2')}>
              {staff && (
                <Block title={`Staff${asOn}`} icon={<Users />}>
                  <StaffTable staff={staff as MisReport['staff']} />
                </Block>
              )}
              {safety && (
                <Block title={`Safety${asOn}`} icon={<HardHat />}>
                  <SafetyTable safety={safety as MisReport['safety']} />
                </Block>
              )}
            </div>
          )}
          <p className="text-ink-400 text-center text-xs">
            Generated {fmtDateTime(m.meta.generatedAt)}
            {logsheet?.submittedBy && ` · logsheet by ${logsheet.submittedBy}`}
          </p>
        </div>
      )}
    </>
  );
}
