'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet, TableProperties } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { addDays, clampDate, isValidISODate, todayIST, type DateRange } from '@/lib/dates';
import { DASH, fmtDate, fmtDateTime, fmtNum } from '@/lib/format';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import type { ReportTable } from '../engine-types';
import type { LogsheetForm } from '../logsheet/types';
import { usePlant } from '../plant-context';
import { useSettings } from '../settings/queries';

export type Row = Record<string, string | number | null>;
export type Query = Record<string, string | undefined>;

/** GET /plants/:id/reports/:slug?…  (format=json). `enabled` lets a page wait for its required filters. */
export function useReport(slug: string, query: Query, enabled = true) {
  const { plant } = usePlant();
  const signedIn = useClientAuth().status === 'authenticated';
  return useQuery({
    queryKey: qk.client.report(plant.id, slug, query),
    queryFn: () => clientApi.get<ReportTable<Row>>(`/plants/${plant.id}/reports/${slug}`, { query }),
    enabled: signedIn && enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Excel / PDF of the same report: the API streams the file (EXP-05). */
export function ExportButtons({ slug, query, disabled }: { slug: string; query: Query; disabled?: boolean }) {
  const { plant } = usePlant();
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null);
  const go = async (format: 'xlsx' | 'pdf') => {
    setBusy(format);
    try {
      await clientApi.download(`/plants/${plant.id}/reports/${slug}`, {
        query: { ...query, format },
        fallbackName: `${slug}.${format}`,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => go('xlsx')} loading={busy === 'xlsx'} disabled={disabled}>
        <FileSpreadsheet /> Excel
      </Button>
      <Button variant="secondary" onClick={() => go('pdf')} loading={busy === 'pdf'} disabled={disabled}>
        <FileDown /> PDF
      </Button>
    </div>
  );
}

/** Filter state kept in the URL (?from=&to=&param=) so a report link can be shared. */
export function useUrlState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const get = useCallback((k: string) => sp.get(k) ?? undefined, [sp]);
  const set = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === '') next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [sp, router, pathname],
  );
  return { get, set };
}

/** from/to in the URL, default: the last 30 days up to yesterday, never before the MIS start. */
export function useRangeState(defaultDays = 30) {
  const { plant } = usePlant();
  const { get, set } = useUrlState();
  const max = addDays(todayIST(), -1) > plant.omEnd ? plant.omEnd : addDays(todayIST(), -1);
  const f = get('from');
  const t = get('to');
  const to = t && isValidISODate(t) ? t : max;
  let from = f && isValidISODate(f) ? f : addDays(to, -(defaultDays - 1));
  if (from < plant.misStart) from = plant.misStart;
  const range: DateRange = { from, to };
  return { range, setRange: (r: DateRange) => set({ from: r.from, to: r.to }), min: plant.misStart, max, get, set };
}

/**
 * Parameters for the pickers. Roles that can read settings use /settings/parameters; viewers cannot, so
 * they get the same list from the logsheet form of the last MIS day (readable by every plant role).
 */
export function useParamOptions(kind: 'sum' | 'any' = 'any') {
  const { plant, can } = usePlant();
  const signedIn = useClientAuth().status === 'authenticated';
  const fromSettings = can('settings.view');
  const q = useSettings('parameters', fromSettings);
  const yesterday = addDays(todayIST(), -1);
  const formDate = clampDate(yesterday, plant.misStart, plant.omEnd);
  const form = useQuery({
    queryKey: qk.client.logForm(plant.id, formDate),
    queryFn: () => clientApi.get<LogsheetForm>(`/plants/${plant.id}/logsheets/${formDate}/form`),
    enabled: !fromSettings && signedIn,
    staleTime: 5 * 60_000,
  });
  const rows = fromSettings
    ? (q.data ?? [])
        .filter((p) => !p.activeTo)
        .map((p) => ({
          code: p.code,
          label: p.shortName ?? p.name,
          unit: p.unit,
          aggregation: p.aggregation,
          linkRole: p.linkRole,
        }))
    : (form.data?.blocks ?? []).flatMap((b) =>
        b.fields.map((f) => ({
          code: f.code,
          label: f.name,
          unit: f.unit,
          aggregation: f.aggregation,
          linkRole: f.linkRole,
        })),
      );
  return rows
    .filter((p) => p.aggregation !== 'text' && (kind === 'any' || p.aggregation === 'sum'))
    .map((p) => ({ value: p.code, label: p.label, unit: p.unit, linkRole: p.linkRole as string | null }));
}

/** Stock items = the parameters linked as "consumed"; the item code is that code without `_CONSUMED`. */
export function useStockItems() {
  return useParamOptions('any')
    .filter((o) => o.linkRole === 'consumed')
    .map((o) => ({ value: o.value.replace(/_CONSUMED$/, ''), label: o.label.replace(/\s*consumed$/i, '') }));
}

const isoRe = /^\d{4}-\d{2}-\d{2}$/;
/** One report cell: ISO dates → 21-Sep-2026, numbers by the column's Excel format, else text. */
export function cell(v: string | number | null | undefined, numFmt?: string, wholeNumbers = false): ReactNode {
  if (v === null || v === undefined || v === '') return <span className="text-ink-300">{DASH}</span>;
  if (typeof v === 'number') {
    if (wholeNumbers && Number.isInteger(v)) return fmtNum(v, 0); // e.g. the "Days with data" footer row
    return fmtNum(v, numFmt?.includes('.00') ? 2 : numFmt ? 0 : Number.isInteger(v) ? 0 : 2);
  }
  if (isoRe.test(v)) return fmtDate(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(v); // timestamps keep the time (submitted at)
  return v;
}

/** Any ReportTable as a DataTable; footer rows (Total, Average…) in bold below. */
export function ReportTableCard({
  table,
  loading,
  error,
  title,
  maxRows = 400,
}: {
  table: ReportTable<Row> | undefined;
  loading?: boolean;
  error?: unknown;
  title?: string;
  maxRows?: number;
}) {
  if (error) {
    return (
      <Card>
        <EmptyState icon={<TableProperties />} title="Could not load the report" description={errorMessage(error)} />
      </Card>
    );
  }
  if (!table) return <Skeleton className="rounded-card h-96" />;
  const columns: Column<Row & { __footer?: boolean }>[] = table.columns.map((c, i) => ({
    key: c.key,
    header: c.header,
    align: c.numFmt ? 'right' : 'left',
    cell: (r) => (
      <span className={cn('tabular', r.__footer && 'text-ink-900 font-semibold', i === 0 && 'whitespace-nowrap')}>
        {cell(r[c.key], c.numFmt, !!r.__footer && /days/i.test(String(r[table.columns[0]?.key ?? ''])))}
      </span>
    ),
  }));
  const rows = [
    ...table.rows.slice(0, maxRows),
    ...(table.footer ?? []).map((f) => ({ ...f, __footer: true as const })),
  ] as Array<Row & { __footer?: boolean }>;
  return (
    <Card>
      <CardHeader
        title={title ?? table.title}
        subtitle={`${table.subtitle ?? ''}${table.rows.length > maxRows ? ` · first ${maxRows} of ${table.rows.length} rows (Excel has all)` : ''}`}
      />
      {table.rows.length === 0 ? (
        <EmptyState
          compact
          icon={<TableProperties />}
          title="Nothing in this period"
          description="Choose another range."
        />
      ) : (
        <DataTable
          dense
          stickyHeader
          className={cn('max-h-[560px] overflow-y-auto', loading && 'opacity-60 transition-opacity')}
          columns={columns}
          rows={rows}
          rowKey={(r, i) => `${String(r[table.columns[0]?.key ?? 'date'])}-${i}`}
        />
      )}
    </Card>
  );
}
