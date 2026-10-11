'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Download, Gauge, LayoutGrid } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
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
import { AlertsCard, ComplianceCard } from './insight-cards';
import { KpiRow } from './kpi-row';
import { ChemicalsCard, ParamCardsGrid, QualityGrid } from './param-widgets';
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
                No logsheet for {fmtDate(reportDate)}. Today’s values are empty; month-to-date and to-date figures still
                include every earlier day.
              </span>
              {can('logsheet.edit') && (
                <Button asChild size="sm" variant="secondary">
                  <Link href={`${hrefFor('logsheet', null)}/${reportDate}`}>Open logsheet</Link>
                </Button>
              )}
            </div>
          )}
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
  const all = [...data.keyParameters, ...data.chemicals];
  const focus = all.find((c) => c.code === focusCode) ?? data.keyParameters.find((c) => c.code !== 'REVENUE') ?? null;
  const render = (id: DashboardWidgetId): ReactNode => {
    switch (id) {
      case 'kpis':
        return data.keyParameters.length ? <KpiRow cards={data.keyParameters} plantId={plantId} /> : null;
      case 'trend':
        return (
          <TrendWidget
            plantId={plantId}
            date={date}
            misStart={misStart}
            focus={focus}
            cards={all}
            onFocus={onFocus}
            powerCards={data.keyParameters.filter((c) => c.unit.toLowerCase() === 'kwh')}
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
        return data.keyParameters.length ? <ParamCardsGrid cards={data.keyParameters} plantId={plantId} /> : null;
      case 'chemicals':
        return data.chemicals.length ? <ChemicalsCard cards={data.chemicals} plantId={plantId} /> : null;
      case 'quality':
        return <QualityGrid cards={data.quality} />;
      case 'cash':
        return <CashCard cash={data.cash} />;
      case 'staff':
        return <StaffCard staff={data.staff} />;
      case 'registers':
        return <RegistersCard registers={data.registers} date={date} />;
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
