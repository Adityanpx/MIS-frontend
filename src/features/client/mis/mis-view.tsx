'use client';

import { Banknote, Download, FlaskConical, Gauge, Package, ShieldCheck, Table2, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DateNav } from '@/components/date/date-nav';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/tabs';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { fmtDateTime, fmtMoney0 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMis } from '../engine-queries';
import type { MisReport, StandardKind } from '../engine-types';
import { usePlantPdf } from '../pdf';
import { usePlantDate } from '../plant-date';
import { usePlant } from '../plant-context';
import { LabTable, RegistersTable, SafetyTable, SimpleParamTable, StaffTable, type MisPeriod } from './mis-tables';

const KINDS: { value: StandardKind; label: string }[] = [
  { value: 'bidding', label: 'Bidding' },
  { value: 'actual', label: 'Actual' },
];
const PERIODS: { value: MisPeriod; label: string }[] = [
  { value: 'today', label: 'Daily' },
  { value: 'mtd', label: 'Monthly' },
  { value: 'utd', label: 'UTD' },
];

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


/** /plants/[plantId]/mis/[[...date]] — the MIS report: one plain page, Daily / Monthly / Up to date. */
export function MisView() {
  const { plant, can } = usePlant();
  const { date, setDate, min, max } = usePlantDate('mis');
  const q = useMis(plant.id, date);
  const pdf = usePlantPdf(plant.id, can('pdf.generate'));
  const [period, setPeriod] = useState<MisPeriod>('today');
  const [kind, setKind] = useState<StandardKind>('actual');

  const m = q.data;
  const reportDate = m?.header.reportDate ?? date ?? max;
  const t = m?.tabs;
  const key = t?.key ?? m?.keyParameters ?? [];
  const chemicals = t?.chemicals ?? m?.chemicals ?? [];
  const lab = t?.compliance.lab ?? m?.lab;
  const registers = t?.compliance.registers ?? m?.registers;
  const cash = t?.administrative.cash ?? m?.cash;
  const staff = t?.administrative.staff ?? m?.staff;
  const safety = t?.administrative.safety ?? m?.safety;
  const logsheet = m?.header.logsheet;

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
            <DateNav value={reportDate} onChange={setDate} min={min} max={max} />
            <Button className="no-print" loading={pdf.busy} onClick={() => void pdf.download(reportDate, 'mis')}>
              <Download />
              Download PDF
            </Button>
          </>
        }
      />

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
          <div className="no-print flex flex-wrap items-center gap-3">
            <Segmented items={PERIODS} value={period} onChange={setPeriod} />
            <Segmented items={KINDS} value={kind} onChange={setKind} />
          </div>
          <Block title="Key parameters" icon={<Gauge />}>
            <SimpleParamTable rows={key} period={period} kind={kind} />
          </Block>
          {chemicals.length > 0 && (
            <Block title="Chemicals" icon={<Package />}>
              <SimpleParamTable rows={chemicals} period={period} kind={kind} chemicals />
            </Block>
          )}
          {lab && (
            <Block title="Quality control" icon={<FlaskConical />}>
              <p className="text-ink-400 mb-2 text-[11px] font-medium tracking-wider uppercase">Inlet</p>
              <LabTable rows={lab.inlet} v11={!!t} />
              <p className="text-ink-400 mt-6 mb-2 text-[11px] font-medium tracking-wider uppercase">Outlet</p>
              <LabTable rows={lab.outlet} v11={!!t} />
            </Block>
          )}
          {registers && (
            <Block title="Bank guarantees & insurance" icon={<ShieldCheck />}>
              <RegistersTable registers={registers} />
            </Block>
          )}
          {cash && (
            <Block title="Site cash" icon={<Banknote />}>
              <CashBlock cash={cash} />
            </Block>
          )}
          {staff && safety && (
            <Block title="Staff & safety" icon={<Users />}>
              <div className="grid gap-6 xl:grid-cols-2">
                <StaffTable staff={staff as MisReport['staff']} />
                <SafetyTable safety={safety as MisReport['safety']} />
              </div>
            </Block>
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
