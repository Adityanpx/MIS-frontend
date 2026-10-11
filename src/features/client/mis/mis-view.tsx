'use client';

import {
  Banknote,
  CalendarRange,
  ClipboardCheck,
  Download,
  FileClock,
  FlaskConical,
  Gauge,
  Package,
  Printer,
  ShieldCheck,
  Table2,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { DateNav } from '@/components/date/date-nav';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, ProgressBar, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtMoney0, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMis } from '../engine-queries';
import type { MisReport } from '../engine-types';
import { usePlantPdf } from '../pdf';
import { usePlantDate } from '../plant-date';
import { usePlant } from '../plant-context';
import { LabTable, ParamTable, RegistersTable, SafetyTable, StaffTable } from './mis-tables';

const SECTIONS = [
  { id: 'key', label: 'Key parameters', icon: Gauge },
  { id: 'chemicals', label: 'Chemicals', icon: Package },
  { id: 'quality', label: 'Lab quality', icon: FlaskConical },
  { id: 'registers', label: 'Guarantees & insurance', icon: ShieldCheck },
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'staff', label: 'Staff & safety', icon: Users },
] as const;

/** Highlights the section currently in view in the sticky section bar. */
function useActiveSection(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      { rootMargin: '-140px 0px -55% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

function Section({
  id,
  title,
  subtitle,
  icon,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.section
      id={id}
      className="scroll-mt-36"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.4 }}
    >
      <Card className="break-inside-avoid">
        <CardHeader title={title} subtitle={subtitle} icon={icon} />
        {children}
      </Card>
    </motion.section>
  );
}

function InfoTile({ label, children, icon }: { label: string; children: ReactNode; icon: ReactNode }) {
  return (
    <div className="rounded-inner border-line bg-surface flex items-start gap-3 border p-4">
      <span className="bg-brand-50 text-brand-500 grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ink-400 text-[11px] font-medium tracking-wider uppercase">{label}</p>
        <div className="text-ink-900 mt-1 text-sm">{children}</div>
      </div>
    </div>
  );
}

function HeaderStrip({ m }: { m: MisReport }) {
  const h = m.header;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <InfoTile label="Report" icon={<CalendarRange />}>
        <span className="font-semibold">{fmtDate(h.reportDate)}</span>
        <span className="text-ink-500 block text-xs">
          O&amp;M month {h.omMonthNo}
          {h.omYearNo && ` · year ${Number(h.omYearNo)}`} · {h.clientName}
        </span>
      </InfoTile>
      <InfoTile label="Month to date" icon={<Table2 />}>
        <span className="tabular font-semibold">
          {h.mtdDataDays} of {h.mtdDays} days
        </span>{' '}
        <span className="text-ink-500 text-xs">with data</span>
        <ProgressBar
          className="mt-2"
          value={h.mtdDataDays}
          max={h.mtdDays}
          tone={h.mtdDataDays < h.mtdDays ? 'warning' : 'success'}
          height={6}
        />
      </InfoTile>
      <InfoTile label="Up to date" icon={<FileClock />}>
        <span className="tabular font-semibold">
          {fmtNum(h.utdDataDays)} of {fmtNum(h.utdDays)} days
        </span>
        <span className="text-ink-500 block text-xs">
          since {fmtDate(h.misStart)} · {h.monthsElapsed} months
        </span>
      </InfoTile>
      <InfoTile label="Logsheet" icon={<ClipboardCheck />}>
        {h.logsheet ? (
          <>
            <span className="flex items-center gap-2">
              <StatusBadge status={h.logsheet.status} size="sm" />
              {h.logsheet.version > 1 && <span className="text-ink-500 text-xs">v{h.logsheet.version}</span>}
            </span>
            <span className="text-ink-500 mt-1 block truncate text-xs">
              {h.logsheet.submittedBy ?? '—'}
              {h.logsheet.submittedAt && ` · ${fmtDateTime(h.logsheet.submittedAt)}`}
              {h.lastCorrectedAt && ` · corrected ${fmtDateTime(h.lastCorrectedAt)}`}
            </span>
          </>
        ) : (
          <Badge tone="warning" dot>
            No logsheet for this date
          </Badge>
        )}
      </InfoTile>
    </div>
  );
}

function CashBlock({ m }: { m: MisReport }) {
  const c = m.cash;
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
            <span className="font-medium">Today’s expense:</span> {c.description}
          </p>
        )}
      </div>
    </div>
  );
}

/** /plants/[plantId]/mis/[[...date]] — the MIS report (PRD §14) rendered from the API JSON; flags decide colours. */
export function MisView() {
  const { plant, can } = usePlant();
  const { date, setDate, hrefFor, min, max } = usePlantDate('mis');
  const q = useMis(plant.id, date);
  const pdf = usePlantPdf(plant.id, can('pdf.generate'));
  const active = useActiveSection(SECTIONS.map((s) => s.id));
  const m = q.data;
  const reportDate = m?.header.reportDate ?? date ?? max;

  return (
    <>
      <PageHeader
        title="MIS report"
        subtitle={m ? `${m.header.plantName} · ${m.header.companyName}` : plant.name}
        actions={
          <>
            <DateNav value={reportDate} onChange={setDate} min={min} max={max} />
            <Button asChild variant="secondary" className="no-print">
              <Link href={hrefFor('dashboard', reportDate)}>
                <Gauge />
                Dashboard
              </Link>
            </Button>
            <Button variant="secondary" className="no-print" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            <Button className="no-print" loading={pdf.busy} onClick={() => void pdf.download(reportDate, 'mis')}>
              <Download />
              Download PDF
            </Button>
          </>
        }
      />

      {q.isLoading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="rounded-inner h-24" />
            ))}
          </div>
          <Skeleton className="rounded-card h-[520px]" />
        </div>
      )}
      {q.isError && !m && (
        <Card>
          <EmptyState
            icon={<Table2 />}
            title="The MIS report could not be loaded"
            description={errorMessage(q.error)}
            action={<Button onClick={() => q.refetch()}>Try again</Button>}
          />
        </Card>
      )}

      {m && (
        <div className={cn('space-y-6 transition-opacity duration-300', q.isPlaceholderData && 'opacity-60')}>
          <HeaderStrip m={m} />

          <nav
            className="no-print scrollbar-none bg-canvas/85 sticky top-[72px] z-20 -mx-4 flex gap-2 overflow-x-auto px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
            aria-label="MIS sections"
          >
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={cn(
                  'relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-medium transition-colors',
                  active === s.id ? 'text-white' : 'border-line bg-surface text-ink-700 hover:text-ink-900 border',
                )}
              >
                {active === s.id && (
                  <motion.span
                    layoutId="mis-section"
                    className="bg-brand-500 absolute inset-0 rounded-full"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <s.icon className="relative size-4" />
                <span className="relative">{s.label}</span>
              </a>
            ))}
          </nav>

          <Section
            id="key"
            title="Key parameters"
            subtitle="STD = standard · ACT = actual · VAR = ACT − STD (blue favourable, red unfavourable)"
            icon={<Gauge />}
          >
            <ParamTable rows={m.keyParameters} />
            {m.revenueDay && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  { l: 'Fixed fee per day', v: m.revenueDay.fixedPerDay },
                  { l: 'Standard revenue today', v: m.revenueDay.std },
                  { l: 'Actual revenue today', v: m.revenueDay.act },
                ].map((t) => (
                  <div key={t.l} className="rounded-inner bg-canvas px-4 py-3">
                    <p className="text-ink-500 text-xs">{t.l}</p>
                    <p className="text-ink-900 tabular mt-0.5 font-semibold">{fmtMoney0(t.v)}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section
            id="chemicals"
            title="Chemicals"
            subtitle="Consumption, receipts and closing balance (red = below the minimum level)"
            icon={<Package />}
          >
            <ParamTable rows={m.chemicals} chemicals />
          </Section>
          <Section
            id="quality"
            title="Lab quality"
            subtitle="Treated water (outlet) and raw sewage (inlet)"
            icon={<FlaskConical />}
          >
            <p className="text-ink-400 mb-2 text-[11px] font-medium tracking-wider uppercase">Outlet</p>
            <LabTable rows={m.lab.outlet} />
            <p className="text-ink-400 mt-6 mb-2 text-[11px] font-medium tracking-wider uppercase">Inlet</p>
            <LabTable rows={m.lab.inlet} />
          </Section>
          <Section
            id="registers"
            title="Bank guarantees & insurance"
            subtitle={`Status on ${fmtDate(reportDate)}`}
            icon={<ShieldCheck />}
          >
            <RegistersTable registers={m.registers} />
          </Section>
          <Section id="cash" title="Site cash" icon={<Banknote />}>
            <CashBlock m={m} />
          </Section>
          <Section id="staff" title="Staff & safety" icon={<Users />}>
            <div className="grid gap-6 xl:grid-cols-2">
              <StaffTable staff={m.staff} />
              <SafetyTable safety={m.safety} />
            </div>
          </Section>
          <p className="text-ink-400 text-center text-xs">
            Generated {fmtDateTime(m.meta.generatedAt)} · data v{m.versions.data} · settings v{m.versions.settings}
          </p>
        </div>
      )}
    </>
  );
}
