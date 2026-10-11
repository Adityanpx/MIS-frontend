'use client';

import { useQuery } from '@tanstack/react-query';
import { FileArchive, FileText, Gauge, Loader2, RefreshCw, Table2, type LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { MonthNav } from '@/components/date/date-nav';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/popover';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { addDays, todayIST, type DateRange } from '@/lib/dates';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { weekday } from '../engine-ui';
import type { PdfDoc } from '../engine-types';
import { useExportJob } from '../export-job';
import { usePlant } from '../plant-context';

const TYPES: Array<{ type: PdfDoc['doc_type']; label: string; icon: LucideIcon }> = [
  { type: 'logsheet', label: 'Logsheet', icon: FileText },
  { type: 'mis', label: 'MIS', icon: Table2 },
  { type: 'dashboard', label: 'Dashboard', icon: Gauge },
];

/** /plants/:id/pdfs — the archive (PRD §17): month → date → 3 documents, regenerate, bulk ZIP. */
export function PdfArchive() {
  const { plant, can } = usePlant();
  const signedIn = useClientAuth().status === 'authenticated';
  const yesterday = addDays(todayIST(), -1);
  const [month, setMonth] = useState((yesterday < plant.omEnd ? yesterday : plant.omEnd).slice(0, 7));
  const [y, m] = month.split('-').map(Number) as [number, number];
  const q = useQuery({
    queryKey: qk.client.pdfs(plant.id, y, m),
    queryFn: () => clientApi.get<PdfDoc[]>(`/plants/${plant.id}/pdfs`, { query: { year: y, month: m } }),
    enabled: signedIn,
    staleTime: 30_000,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>({ from: `${month}-01`, to: yesterday });
  const [exportId, setExportId] = useState<string | null>(null);
  const job = useExportJob(exportId);

  /**
   * One document per date and type: the newest current / out-of-date version. A failed retry does not
   * replace a good file (the API keeps the old version current), so "failed" shows only when nothing else exists.
   */
  const byDate = useMemo(() => {
    const rank = (d: PdfDoc) => (d.status === 'current' || d.status === 'stale' ? 2 : d.status === 'failed' ? 1 : 0);
    const map = new Map<string, Partial<Record<PdfDoc['doc_type'], PdfDoc>>>();
    for (const d of q.data ?? []) {
      if (d.status === 'superseded') continue;
      const date = d.date.slice(0, 10);
      const e = map.get(date) ?? {};
      const cur = e[d.doc_type];
      if (!cur || rank(d) > rank(cur) || (rank(d) === rank(cur) && d.version > cur.version)) e[d.doc_type] = d;
      map.set(date, e);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [q.data]);

  async function open(doc: PdfDoc) {
    setBusy(doc.id);
    try {
      await clientApi.download(`/plants/${plant.id}/pdfs/${doc.id}/download`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }
  async function generate(body: { date: string } | { from: string; to: string }) {
    try {
      await clientApi.post(`/plants/${plant.id}/pdfs/generate`, body);
      toast.success('PDFs are being generated', { description: 'Refresh in a minute to see them here.' });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  async function zip() {
    try {
      const r = await clientApi.post<{ exportId: string }>(`/plants/${plant.id}/pdfs/zip`, range);
      setExportId(r.exportId);
      toast.message('Preparing the ZIP…', { description: 'It downloads by itself when ready.' });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const total = byDate.reduce(
    (n, [, docs]) => n + Object.values(docs).filter((d) => d?.status === 'current').length,
    0,
  );
  return (
    <>
      <PageHeader
        title="PDF archive"
        subtitle={`${plant.name} · logsheet (A4), MIS (A3) and dashboard (A3) of every submitted day`}
        actions={
          <>
            <MonthNav value={month} onChange={setMonth} min={plant.misStart} max={yesterday} />
            <Button variant="secondary" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={cn(q.isFetching && 'animate-spin')} /> Refresh
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title={`${byDate.length} day(s)`} subtitle={`${total} current document(s) this month`} />
          {q.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : byDate.length === 0 ? (
            <EmptyState
              icon={<FileArchive />}
              title="No PDFs this month"
              description="PDFs are created automatically after each logsheet is submitted."
            />
          ) : (
            <ul className="divide-line divide-y">
              {byDate.map(([date, docs], i) => (
                <motion.li
                  key={date}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 15) * 0.02 }}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="w-36">
                    <p className="text-ink-900 tabular text-sm font-semibold">{fmtDate(date)}</p>
                    <p className="text-ink-400 text-xs">{weekday(date)}</p>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {TYPES.map(({ type, label, icon: Icon }) => {
                      const d = docs[type];
                      if (!d)
                        return (
                          <span
                            key={type}
                            className="border-line text-ink-300 inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed px-3 text-xs"
                          >
                            <Icon className="size-3.5" /> {label}
                          </span>
                        );
                      const tone =
                        d.status === 'current'
                          ? 'border-success-100 bg-success-50 text-success-600'
                          : d.status === 'stale'
                            ? 'border-warning-100 bg-warning-50 text-warning-600'
                            : 'border-danger-100 bg-danger-50 text-danger-600';
                      return (
                        <Tooltip
                          key={type}
                          content={`v${d.version} · ${d.status}${d.generated_at ? ` · ${fmtDateTime(d.generated_at)}` : ''}${d.reason ? ` · ${d.reason}` : ''}`}
                        >
                          <button
                            type="button"
                            disabled={d.status === 'failed' || busy === d.id}
                            onClick={() => void open(d)}
                            className={cn(
                              'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-60',
                              tone,
                            )}
                          >
                            {busy === d.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Icon className="size-3.5" />
                            )}
                            {label}
                            {d.status === 'stale' && <span className="font-normal">· old</span>}
                          </button>
                        </Tooltip>
                      );
                    })}
                  </div>
                  {can('pdf.generate') && (
                    <Button size="sm" variant="ghost" onClick={() => void generate({ date })}>
                      <RefreshCw /> Regenerate
                    </Button>
                  )}
                </motion.li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-6 lg:sticky lg:top-[96px]">
          <Card>
            <CardHeader title="Legend" />
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="success" dot>
                Current
              </Badge>
              <Badge tone="warning" dot>
                Out of date — a newer version is coming
              </Badge>
              <Badge tone="danger" dot>
                Failed
              </Badge>
            </div>
          </Card>
          {can('pdf.zip') && (
            <Card>
              <CardHeader title="Several days" subtitle="Up to 366 days at a time" />
              <DateRangePicker
                value={range}
                onChange={setRange}
                min={plant.misStart}
                max={yesterday}
                className="w-full justify-between"
              />
              <div className="mt-4 grid gap-2">
                <Button onClick={zip} loading={job.data?.status === 'building' || job.data?.status === 'queued'}>
                  <FileArchive /> Download as ZIP
                </Button>
                <Button variant="secondary" onClick={() => void generate(range)}>
                  <RefreshCw /> Regenerate this range
                </Button>
              </div>
              {(job.data?.status === 'building' || job.data?.status === 'queued') && (
                <p className="text-ink-500 mt-3 flex items-center gap-1.5 text-xs">
                  <Loader2 className="size-3.5 animate-spin" /> Building the ZIP…
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
