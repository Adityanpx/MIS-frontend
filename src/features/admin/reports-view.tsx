'use client';

import {
  ArrowRight,
  BadgeIndianRupee,
  Banknote,
  Building2,
  CalendarClock,
  Clock,
  Factory,
  FileDown,
  FileSpreadsheet,
  FileText,
  History,
  Landmark,
  Layers,
  Receipt,
  Activity,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { HoverLift, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { fyStart, todayIST, type DateRange } from '@/lib/dates';
import type { AdminReportKey } from '@/shared/enums';
import type { ReportTable } from '../client/engine-types';
import { ReportTableCard, type Row } from '../client/reports/report-kit';
import { adminDownload, ClientSelect, FilterBar, useA } from './kit';

interface Def {
  key: AdminReportKey;
  title: string;
  description: string;
  icon: LucideIcon;
  dated?: boolean;
  window?: boolean;
  group: 'Money' | 'Contracts' | 'Platform';
}
const REPORTS: Def[] = [
  {
    key: 'revenue',
    title: 'Revenue register',
    description: 'Invoices issued, taxable value and GST',
    icon: Receipt,
    dated: true,
    group: 'Money',
  },
  {
    key: 'collections',
    title: 'Collections',
    description: 'Payments received by mode',
    icon: Banknote,
    dated: true,
    group: 'Money',
  },
  {
    key: 'ageing',
    title: 'Outstanding & ageing',
    description: '0–30, 31–60, 61–90, 90+ days',
    icon: Clock,
    group: 'Money',
  },
  {
    key: 'gst-register',
    title: 'GST register',
    description: 'Invoices and credit notes for GSTR-1',
    icon: Landmark,
    dated: true,
    group: 'Money',
  },
  {
    key: 'tds',
    title: 'TDS receivable',
    description: 'By quarter, with certificate status',
    icon: BadgeIndianRupee,
    dated: true,
    group: 'Money',
  },
  {
    key: 'cheques',
    title: 'Cheque register',
    description: 'Pending, cleared and bounced cheques',
    icon: FileText,
    dated: true,
    group: 'Money',
  },
  {
    key: 'renewals',
    title: 'Renewals due',
    description: 'Subscriptions and O&M contracts ending',
    icon: CalendarClock,
    window: true,
    group: 'Contracts',
  },
  {
    key: 'contract-value',
    title: 'Contract value',
    description: 'Total and remaining value per subscription',
    icon: Layers,
    group: 'Contracts',
  },
  {
    key: 'subscriptions',
    title: 'Subscriptions',
    description: 'Every subscription with plan and period',
    icon: CalendarClock,
    group: 'Contracts',
  },
  {
    key: 'clients',
    title: 'Clients',
    description: 'All clients with state and counts',
    icon: Building2,
    group: 'Platform',
  },
  {
    key: 'plants',
    title: 'Plants',
    description: 'All plants with O&M period and status',
    icon: Factory,
    group: 'Platform',
  },
  {
    key: 'usage',
    title: 'Usage',
    description: 'Users, storage and logsheets per plant',
    icon: Activity,
    group: 'Platform',
  },
  {
    key: 'lifecycle-history',
    title: 'Account state history',
    description: 'Every grace / read-only / suspension change',
    icon: History,
    dated: true,
    group: 'Platform',
  },
];

/** /admin/reports and /admin/reports/:key (SA-RPT-01…13). Excel and PDF use the same endpoint. */
export function AdminReportsView({ slug }: { slug?: string }) {
  const def = REPORTS.find((r) => r.key === slug);
  return def ? <OneReport def={def} /> : <ReportsHome />;
}

function ReportsHome() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Every report opens on screen and downloads as Excel or PDF" />
      {(['Money', 'Contracts', 'Platform'] as const).map((g) => (
        <section key={g} className="mb-8">
          <h2 className="text-ink-500 mb-3 text-xs font-semibold tracking-wider uppercase">{g}</h2>
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {REPORTS.filter((r) => r.group === g).map((r) => (
              <StaggerItem key={r.key}>
                <HoverLift>
                  <Link href={`/admin/reports/${r.key}`}>
                    <Card className="group flex h-full items-start gap-4">
                      <span className="bg-brand-50 text-brand-500 grid size-11 shrink-0 place-items-center rounded-2xl">
                        <r.icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-ink-900 font-semibold">{r.title}</p>
                        <p className="text-ink-500 mt-0.5 text-sm">{r.description}</p>
                      </div>
                      <ArrowRight className="text-ink-300 group-hover:text-brand-500 size-5 transition-colors" />
                    </Card>
                  </Link>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ))}
    </>
  );
}

function OneReport({ def }: { def: Def }) {
  const [range, setRange] = useState<DateRange>({ from: fyStart(todayIST()), to: todayIST() });
  const [clientId, setClientId] = useState<string | undefined>();
  const [windowDays, setWindowDays] = useState('90');
  const query = {
    clientId,
    ...(def.dated ? range : {}),
    ...(def.window ? { windowDays: Number(windowDays) } : {}),
  };
  const r = useA<ReportTable<Row>>(`/reports/${def.key}`, { ...query, format: 'json' });
  const dl = (format: 'xlsx' | 'pdf') =>
    adminDownload(`/reports/${def.key}`, { ...query, format }, `${def.key}.${format}`);
  return (
    <>
      <PageHeader
        title={def.title}
        subtitle={def.description}
        crumbs={[{ label: 'Reports', href: '/admin/reports' }, { label: def.title }]}
        actions={
          <>
            <Button variant="secondary" onClick={() => void dl('xlsx')}>
              <FileSpreadsheet /> Excel
            </Button>
            <Button variant="secondary" onClick={() => void dl('pdf')}>
              <FileDown /> PDF
            </Button>
          </>
        }
      />
      <FilterBar>
        <ClientSelect all value={clientId} onChange={setClientId} className="w-64" />
        {def.dated && (
          <DateRangePicker
            value={range}
            onChange={setRange}
            max={todayIST()}
            presets={['this_month', 'last_month', 'this_fy', '30d']}
          />
        )}
        {def.window && (
          <Select
            className="w-44"
            size="sm"
            aria-label="Window"
            value={windowDays}
            onValueChange={setWindowDays}
            options={['30', '60', '90', '180', '365'].map((d) => ({ value: d, label: `Next ${d} days` }))}
          />
        )}
      </FilterBar>
      <ReportTableCard table={r.data} loading={r.isFetching} error={r.error} />
    </>
  );
}
