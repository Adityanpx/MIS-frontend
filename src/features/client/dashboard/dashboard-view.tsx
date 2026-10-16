'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Download, Gauge, LayoutGrid } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { DateNav } from '@/components/date/date-nav';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { fmtDate } from '@/lib/format';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { DEFAULT_DASHBOARD_WIDGETS, type DashboardLayout, type DashboardWidgetId } from '@/shared/schemas/dashboard';
import { useDashboard, useDashboardLayout, useSaveLayout, type LayoutResponse } from '../engine-queries';
import type { DashboardData } from '../engine-types';
import { usePlantPdf } from '../pdf';
import { usePlantDate } from '../plant-date';
import { usePlant } from '../plant-context';
import { LabTable, MaintenanceTabSection, RegistersTable } from '../mis/mis-tables';
import { AlertsCard, ComplianceCard } from './insight-cards';
import { KpiRow } from './kpi-row';
import { ChemicalsCard, DashboardCardsV11Grid, ParamCardsGrid, QualityGrid } from './param-widgets';
import { CashCard, RegistersCard, StaffCard } from './side-widgets';
import { Last7Widget, TrendWidget } from './trend-widgets';
import { toSegments } from './widgets';
import { WidgetDrawer } from './widget-drawer';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="rounded-card h-[150px]" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Skeleton className="rounded-card h-[460px]" />
        <Skeleton className="rounded-card h-[460px]" />
      </div>
    </div>
  );
}

/** /plants/[plantId]/dashboard/[[...date]] — PRD §15 dashboard, laid out like the reference video. */
export function DashboardView() {
  const { plant, can } = usePlant();
  const auth = useClientAuth();
  const qc = useQueryClient();
  const { date, setDate, hrefFor, min, max } = usePlantDate('dashboard');
  const q = useDashboard(plant.id, date);
  const layoutQ = useDashboardLayout(plant.id);
  const save = useSaveLayout(plant.id);
  const pdf = usePlantPdf(plant.id, can('pdf.generate'));
  const [drawer, setDrawer] = useState(false);

  const layout = layoutQ.data?.layout ?? null;
  const widgets: DashboardWidgetId[] = layout?.widgets ?? DEFAULT_DASHBOARD_WIDGETS;
  const readOnly = auth.isActingAs;

  const apply = (next: DashboardLayout | null) => {
    if (readOnly) {
      const prev = qc.getQueryData<LayoutResponse>(qk.client.layout(plant.id));
      if (prev) qc.setQueryData<LayoutResponse>(qk.client.layout(plant.id), { ...prev, layout: next });
      return;
    }
    save.mutate(next, { onError: (e) => toast.error(errorMessage(e)) });
  };
  const setWidgets = (w: DashboardWidgetId[]) => apply({ version: 1, widgets: w, focus: layout?.focus ?? null });
  const setFocus = (code: string) => apply({ version: 1, widgets, focus: code });

  const d = q.data;
  const reportDate = d?.header.reportDate ?? date ?? max;
  const logsheet = d?.header.logsheet ?? null;

  return (
    <>
      <PageHeader
        title="Dashboard"
        badge={
          d &&
          (logsheet ? (
            <StatusBadge status={logsheet.status} />
          ) : (
            <Badge tone="warning" dot>
              No logsheet
            </Badge>
          ))
        }
        subtitle={
          d
            ? `${plant.name} · ${fmtDate(reportDate)} · O&M month ${d.summary.omMonthNo}${d.summary.omYearNo ? ` (year ${Number(d.summary.omYearNo)})` : ''}`
            : plant.name
        }
        actions={
          <>
            <DateNav value={reportDate} onChange={setDate} min={min} max={max} />
            <Button variant="secondary" onClick={() => setDrawer(true)}>
              <LayoutGrid />
              Customize
            </Button>
            <Button loading={pdf.busy} onClick={() => void pdf.download(reportDate, 'dashboard')}>
              <Download />
              Export
            </Button>
          </>
        }
      />

      {q.isLoading && <DashboardSkeleton />}
      {q.isError && !d && (
        <Card>
          <EmptyState
            icon={<Gauge />}
            title="The dashboard could not be loaded"
            description={errorMessage(q.error)}
            action={<Button onClick={() => q.refetch()}>Try again</Button>}
          />
        </Card>
      )}

      {d && (
        <motion.div className={cn('space-y-6 transition-opacity duration-300', q.isPlaceholderData && 'opacity-60')}>
          {!logsheet && (
            <div className="border-warning-100 bg-warning-50 text-ink-700 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-[13px] sm:flex-row sm:items-center">
              <ClipboardList className="text-warning-500 size-5 shrink-0" />
              <span className="flex-1">
                No logsheet for {fmtDate(reportDate)}. Today&apos;s values are empty; month-to-date and to-date figures still
                include every earlier day.
              </span>
              {can('logsheet.edit') && (
                <Button asChild size="sm" variant="secondary">
                  <Link href={`${hrefFor('logsheet', null)}/${reportDate}`}>Open logsheet</Link>
                </Button>
              )}
            </div>
          )}
          {d.tabs ? (
            <V11DashboardTabs data={d} plantId={plant.id} />
          ) : (
            <>
              <Widgets
                data={d}
                widgets={widgets}
                plantId={plant.id}
                misStart={plant.misStart}
                date={reportDate}
                focusCode={layout?.focus ?? null}
                onFocus={setFocus}
              />
              {widgets.length === 0 && (
                <Card>
                  <EmptyState
                    icon={<LayoutGrid />}
                    title="Your dashboard is empty"
                    description="Add widgets to build your own view of this plant."
                    action={<Button onClick={() => setDrawer(true)}>Add widgets</Button>}
                  />
                </Card>
              )}
            </>
          )}
        </motion.div>
      )}

      <WidgetDrawer
        open={drawer}
        onOpenChange={setDrawer}
        widgets={widgets}
        onChange={setWidgets}
        onReset={() => apply(null)}
        readOnly={readOnly}
      />
    </>
  );
}

function Widgets({
  data,
  widgets,
  plantId,
  misStart,
  date,
  focusCode,
  onFocus,
}: {
  data: DashboardData;
  widgets: DashboardWidgetId[];
  plantId: string;
  misStart: string;
  date: string;
  focusCode: string | null;
  onFocus: (code: string) => void;
}) {
  const kps = data.keyParameters ?? [];
  const chems = data.chemicals ?? [];
  const all = [...kps, ...chems];
  const focus = all.find((c) => c.code === focusCode) ?? kps.find((c) => c.code !== 'REVENUE') ?? null;
  const render = (id: DashboardWidgetId): ReactNode => {
    switch (id) {
      case 'kpis':
        return kps.length ? <KpiRow cards={kps} plantId={plantId} /> : null;
      case 'trend':
        return (
          <TrendWidget
            plantId={plantId}
            date={date}
            misStart={misStart}
            focus={focus}
            cards={all}
            onFocus={onFocus}
            powerCards={kps.filter((c) => c.unit.toLowerCase() === 'kwh')}
          />
        );
      case 'alerts':
        return <AlertsCard alerts={data.alerts} plantId={plantId} date={date} />;
      case 'last7':
        return <Last7Widget plantId={plantId} date={date} misStart={misStart} focus={focus} />;
      case 'compliance':
        return data.summary.compliance.parameters > 0 ? (
          <ComplianceCard summary={data.summary} plantId={plantId} />
        ) : null;
      case 'params':
        return kps.length ? <ParamCardsGrid cards={kps} plantId={plantId} /> : null;
      case 'chemicals':
        return chems.length ? <ChemicalsCard cards={chems} plantId={plantId} /> : null;
      case 'quality':
        return data.quality ? <QualityGrid cards={data.quality} /> : null;
      case 'cash':
        return data.cash ? <CashCard cash={data.cash} /> : null;
      case 'staff':
        return data.staff ? <StaffCard staff={data.staff} /> : null;
      case 'registers':
        return data.registers ? <RegistersCard registers={data.registers} date={date} /> : null;
    }
  };
  const item = (id: DashboardWidgetId) => {
    const node = render(id);
    return node ? (
      <motion.div key={id} layout="position" transition={{ type: 'spring', stiffness: 380, damping: 36 }}>
        {node}
      </motion.div>
    ) : null;
  };
  return (
    <>
      {toSegments(widgets).map((s, i) => {
        if (s.kind === 'full') return item(s.id);
        if (s.main.length && s.side.length) {
          return (
            <div key={`seg-${i}`} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <div className="space-y-6">{s.main.map(item)}</div>
              <div className="space-y-6">{s.side.map(item)}</div>
            </div>
          );
        }
        if (s.side.length) {
          return (
            <div key={`seg-${i}`} className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
              {s.side.map(item)}
            </div>
          );
        }
        return (
          <div key={`seg-${i}`} className="space-y-6">
            {s.main.map(item)}
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// v1.1 tabbed dashboard
// ---------------------------------------------------------------------------
type DashTab = 'key' | 'chemicals' | 'compliance' | 'administrative' | 'maintenance';

function V11DashboardTabs({ data, plantId }: { data: DashboardData; plantId: string }) {
  const tabs = data.tabs!;
  const labels = data.header.tabLabels ?? {};
  const [tab, setTab] = useState<DashTab>('key');

  const tabItems: TabItem<DashTab>[] = [
    { value: 'key', label: labels.key ?? 'Key params' },
    { value: 'chemicals', label: labels.chemicals ?? 'Chemicals', count: tabs.chemicals.length || undefined },
    { value: 'compliance', label: labels.compliance ?? 'Compliance' },
    { value: 'administrative', label: labels.administrative ?? 'Administrative' },
    ...(tabs.maintenance ? [{ value: 'maintenance' as DashTab, label: labels.maintenance ?? 'Maintenance' }] : []),
  ];

  return (
    <div>
      <Tabs items={tabItems} value={tab} onChange={setTab} className="mb-6" />

      {tab === 'key' && (
        <div className="space-y-6">
          <DashboardCardsV11Grid cards={tabs.key} plantId={plantId} />
          <AlertsCard alerts={data.alerts} plantId={plantId} date={data.header.reportDate} />
        </div>
      )}

      {tab === 'chemicals' && (
        <DashboardCardsV11Grid cards={tabs.chemicals} plantId={plantId} />
      )}

      {tab === 'compliance' && (
        <div className="space-y-6">
          {tabs.compliance.lab.inlet.length > 0 && (
            <div>
              <h3 className="text-ink-700 mb-3 text-sm font-semibold">Inlet</h3>
              <LabTable rows={tabs.compliance.lab.inlet} v11 />
            </div>
          )}
          {tabs.compliance.lab.outlet.length > 0 && (
            <div>
              <h3 className="text-ink-700 mb-3 text-sm font-semibold">Outlet</h3>
              <LabTable rows={tabs.compliance.lab.outlet} v11 />
            </div>
          )}
          {(tabs.compliance.registers.bankGuarantees.length > 0 ||
            tabs.compliance.registers.insurance.length > 0) && (
            <RegistersTable registers={tabs.compliance.registers} />
          )}
        </div>
      )}

      {tab === 'administrative' && (
        <div className="grid gap-6 xl:grid-cols-2">
          {tabs.administrative.staff.length > 0 && (
            <StaffCard staff={tabs.administrative.staff} />
          )}
          {tabs.administrative.cash && (
            <CashCard cash={tabs.administrative.cash} />
          )}
        </div>
      )}

      {tab === 'maintenance' && tabs.maintenance && (
        <MaintenanceTabSection data={tabs.maintenance} plantId={plantId} />
      )}
    </div>
  );
}
