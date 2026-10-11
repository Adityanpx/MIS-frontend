'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { PageHeader } from '@/components/shell/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Checkbox, EmptyState } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/ui/table';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { addDays, todayIST, type DateRange } from '@/lib/dates';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { qk } from '@/lib/query/keys';
import { downloadExport, isDownloadable, isRunning, useExportJob, type ExportJob } from '../export-job';
import { usePlants } from '../queries';
import { ClientAdminOnly } from './company-api';

const TYPE_LABEL: Record<string, string> = {
  client_full: 'Full company export',
  logsheets: 'Logsheet data',
  pdf_zip: 'PDF ZIP',
};

/** /company/export — data export (EXP-01…04): everything as a ZIP, or one plant's logsheets as Excel. */
export function ExportView() {
  const signedIn = useClientAuth().status === 'authenticated';
  const isAdmin = !!useClientAuth().profile?.user.isClientAdmin;
  const qc = useQueryClient();
  const plants = usePlants();
  const list = useQuery({
    queryKey: qk.client.companyExports,
    queryFn: () => clientApi.get<ExportJob[]>('/company/exports'),
    enabled: signedIn && isAdmin, // Client Admin only (403 otherwise)
    refetchInterval: (q) => (q.state.data?.some((e) => isRunning(e)) ? 3000 : false),
  });
  const [pick, setPick] = useState<string[] | null>(null); // null = all plants
  const [busy, setBusy] = useState(false);
  const [plantId, setPlantId] = useState<string | undefined>();
  const [range, setRange] = useState<DateRange>({ from: addDays(todayIST(), -90), to: addDays(todayIST(), -1) });
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useExportJob(jobId);
  const pid = plantId ?? plants.data?.[0]?.id;

  async function full() {
    setBusy(true);
    try {
      await clientApi.post('/company/exports', pick ? { plantIds: pick } : {});
      toast.success('Export started', {
        description: 'Large companies take a few minutes. It appears below when ready.',
      });
      void qc.invalidateQueries({ queryKey: qk.client.companyExports });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function logsheets() {
    if (!pid) return;
    try {
      const r = await clientApi.post<{ exportId: string }>(`/plants/${pid}/exports/logsheets`, range);
      setJobId(r.exportId);
      toast.message('Preparing the Excel file…', { description: 'It downloads by itself when ready.' });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  const toggle = (id: string) => {
    const all = (plants.data ?? []).map((p) => p.id);
    const cur = pick ?? all;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setPick(next.length === all.length ? null : next);
  };

  return (
    <ClientAdminOnly title="Data export">
      <PageHeader
        title="Data export"
        subtitle="Your data is yours: download it any time, also after the contract ends"
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Archive />}
            title="Full company export"
            subtitle="A ZIP with every logsheet (Excel), settings, users, invoices and all archived PDFs"
          />
          <ul className="rounded-inner border-line divide-line mb-5 divide-y border">
            {(plants.data ?? []).map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <Checkbox
                  checked={pick === null || pick.includes(p.id)}
                  onCheckedChange={() => toggle(p.id)}
                  aria-label={p.name}
                />
                <span className="text-ink-900 flex-1 text-sm font-medium">{p.name}</span>
                <span className="text-ink-400 text-xs">{p.code}</span>
              </li>
            ))}
          </ul>
          <Button className="w-full" onClick={full} loading={busy} disabled={pick !== null && pick.length === 0}>
            <Archive /> Start export ({pick ? pick.length : 'all'} plant{pick?.length === 1 ? '' : 's'})
          </Button>
        </Card>
        <Card>
          <CardHeader
            icon={<FileSpreadsheet />}
            title="Logsheet data (Excel)"
            subtitle="One plant, any period — the same layout as the import template"
          />
          <div className="space-y-3">
            <Select
              value={pid}
              onValueChange={setPlantId}
              options={(plants.data ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code }))}
            />
            <DateRangePicker value={range} onChange={setRange} max={todayIST()} className="w-full justify-between" />
            <Button className="w-full" variant="secondary" onClick={logsheets} disabled={!pid || isRunning(job.data)}>
              {isRunning(job.data) ? <Loader2 className="animate-spin" /> : <Download />} Download Excel
            </Button>
          </div>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Recent exports" subtitle="Files stay available for 7 days" />
        {list.data && list.data.length === 0 ? (
          <EmptyState compact icon={<Archive />} title="No exports yet" />
        ) : (
          <DataTable
            loading={list.isLoading}
            rows={list.data}
            rowKey={(e) => e.id}
            columns={[
              {
                key: 'type',
                header: 'Export',
                cell: (e) => (
                  <span className="text-ink-900 font-semibold">{TYPE_LABEL[e.scope.type ?? ''] ?? 'Export'}</span>
                ),
              },
              {
                key: 'scope',
                header: 'Scope',
                hideBelow: 'md',
                cell: (e) => (
                  <span className="text-ink-500 text-xs">
                    {e.scope.from
                      ? `${fmtDate(e.scope.from)} – ${fmtDate(e.scope.to)}`
                      : e.scope.plantIds
                        ? `${e.scope.plantIds.length} plant(s)`
                        : 'All plants'}
                  </span>
                ),
              },
              {
                key: 'created',
                header: 'Requested',
                cell: (e) => <span className="text-ink-500 text-xs">{fmtDateTime(e.createdAt)}</span>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (e) => (
                  <StatusBadge
                    status={
                      isRunning(e)
                        ? 'running'
                        : e.status === 'ready' && !isDownloadable(e)
                          ? 'expired'
                          : e.status === 'ready'
                            ? 'done'
                            : e.status
                    }
                    label={
                      e.status === 'queued'
                        ? 'Waiting'
                        : e.status === 'ready' && !isDownloadable(e)
                          ? 'Expired'
                          : undefined
                    }
                    size="sm"
                  />
                ),
              },
              {
                key: 'dl',
                header: '',
                align: 'right',
                cell: (e) =>
                  isDownloadable(e) ? (
                    <Button size="sm" variant="soft" onClick={() => void downloadExport(e.id)}>
                      <Download /> Download
                    </Button>
                  ) : e.error ? (
                    <span className="text-danger-600 text-xs">{e.error}</span>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>
    </ClientAdminOnly>
  );
}
