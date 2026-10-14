'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  Check,
  CircleAlert,
  ClipboardList,
  CloudUpload,
  Copy,
  Download,
  FileSpreadsheet,
  FileWarning,
  Gauge,
  Loader2,
  RotateCcw,
  Rows3,
  ShieldAlert,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Skeleton, Switch } from '@/components/ui/misc';
import { Segmented, Tabs } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/table';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { DASH, fmtDate, fmtDateTime, fmtNum } from '@/lib/format';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { buildXlsx, saveBlob } from '@/lib/xlsx-lite';
import { invalidatePlantData } from '../logsheet/queries';
import { usePlant } from '../plant-context';
import { useSettings } from '../settings/queries';
import type { ApplyBody, ImportJob, ImportMapping, ImportStatus } from './types';

const MAX_BYTES = 20 * 1024 * 1024;
const STEPS = ['Upload', 'Check', 'Review', 'Import'];
const stepOf = (s: ImportStatus | null) => (s === null ? 0 : s === 'validating' ? 1 : s === 'validated' ? 2 : 3);

function Stepper({ step, failed }: { step: number; failed: boolean }) {
  return (
    <ol className="mb-6 flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const done = i < step || (i === 3 && step === 4);
        const active = i === Math.min(step, 3);
        return (
          <li key={s} className="flex flex-1 items-center gap-2 sm:gap-3">
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold transition-colors duration-300',
                done
                  ? 'bg-success-500 text-white'
                  : active
                    ? failed
                      ? 'bg-danger-500 text-white'
                      : 'bg-primary-btn text-white'
                    : 'bg-muted-bg text-ink-400',
              )}
            >
              {done ? <Check className="size-4" /> : i + 1}
            </span>
            <span
              className={cn('hidden text-sm font-medium sm:block', active || done ? 'text-ink-900' : 'text-ink-400')}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <span className="bg-line relative h-0.5 flex-1 overflow-hidden rounded-full">
                <motion.span
                  className="bg-success-500 absolute inset-y-0 left-0"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.5 }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Tile({
  icon,
  label,
  value,
  tone = 'brand',
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: 'brand' | 'danger' | 'warning' | 'success';
  sub?: ReactNode;
}) {
  const t = {
    brand: 'bg-brand-50 text-brand-500',
    danger: 'bg-danger-50 text-danger-500',
    warning: 'bg-warning-50 text-warning-500',
    success: 'bg-success-50 text-success-600',
  }[tone];
  return (
    <Card padded={false} className="p-5">
      <span className={cn('grid size-9 place-items-center rounded-xl [&_svg]:size-[18px]', t)}>{icon}</span>
      <p className="text-ink-500 mt-3 text-sm">{label}</p>
      <p className="text-ink-900 tabular mt-0.5 text-2xl font-semibold">{value}</p>
      {sub && <p className="text-ink-400 mt-0.5 text-xs">{sub}</p>}
    </Card>
  );
}

/** Upload step: choose the layout, drop the workbook, or download this plant's template. */
function UploadStep({ onUploaded }: { onUploaded: (id: string) => void }) {
  const { plant } = usePlant();
  const params = useSettings('parameters');
  const [mapping, setMapping] = useState<ImportMapping>('excel_data_entry');
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) return void toast.error('Choose an .xlsx or .xlsm workbook.');
    if (f.size > MAX_BYTES) return void toast.error('The workbook is larger than 20 MB.');
    setFile(f);
  };
  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('mapping', mapping);
      fd.append('file', file);
      const r = await clientApi.upload<{ id: string }>(`/plants/${plant.id}/imports`, fd);
      onUploaded(r.id);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }
  function template() {
    const typed = (params.data ?? []).filter((p) => p.inputMode !== 'calculated' && !p.activeTo);
    const header = ['DATE', ...typed.map((p) => p.code)];
    saveBlob(
      buildXlsx([
        {
          name: 'Logsheets',
          header: true,
          rows: [header],
          widths: [12, ...typed.map((p) => Math.max(10, p.code.length + 2))],
        },
        {
          name: 'How to fill',
          header: true,
          widths: [26, 40, 12, 14],
          rows: [
            ['CODE', 'PARAMETER', 'UNIT', 'MANDATORY'],
            ['DATE', 'One row per day, YYYY-MM-DD or an Excel date', '', 'yes'],
            ...typed.map((p) => [p.code, p.name, p.unit, p.mandatory && p.aggregation !== 'text' ? 'yes' : 'no']),
          ],
        },
      ]),
      `${plant.code}_logsheet_import_template.xlsx`,
    );
  }

  const options: Array<{ id: ImportMapping; title: string; text: string; icon: ReactNode }> = [
    {
      id: 'excel_data_entry',
      title: 'Old Excel MIS workbook',
      text: 'The .xlsm you used until now. We read the DATA ENTRY sheet from row 7 and suggest the opening balances.',
      icon: <FileSpreadsheet />,
    },
    {
      id: 'template',
      title: 'OMMIS template',
      text: 'Row 1 = DATE and parameter codes, one row per day. Best for other sources.',
      icon: <Rows3 />,
    },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="1 · What are you importing?" />
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMapping(o.id)}
              className={cn(
                'rounded-inner relative border p-4 text-left transition-[border-color,box-shadow]',
                mapping === o.id ? 'border-brand-500 ring-brand-500/12 ring-4' : 'border-line hover:border-ink-300',
              )}
            >
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-xl [&_svg]:size-5',
                  mapping === o.id ? 'bg-brand-500 text-white' : 'bg-muted-bg text-ink-500',
                )}
              >
                {o.icon}
              </span>
              <p className="text-ink-900 mt-3 text-sm font-semibold">{o.title}</p>
              <p className="text-ink-500 mt-1 text-xs">{o.text}</p>
              {mapping === o.id && (
                <motion.span
                  layoutId="mapping-check"
                  className="bg-brand-500 absolute top-3 right-3 grid size-5 place-items-center rounded-full text-white"
                >
                  <Check className="size-3" />
                </motion.span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-6">
          <CardHeader
            title="2 · Choose the workbook"
            action={
              mapping === 'template' ? (
                <Button size="sm" variant="soft" onClick={template} disabled={!params.data}>
                  <Download /> Template for {plant.code}
                </Button>
              ) : undefined
            }
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              'rounded-inner flex cursor-pointer flex-col items-center justify-center border-2 border-dashed px-6 py-10 text-center transition-colors',
              drag
                ? 'border-brand-500 bg-brand-50'
                : file
                  ? 'border-success-400 bg-success-50/50'
                  : 'border-line hover:border-brand-300 hover:bg-canvas',
            )}
          >
            <motion.span
              animate={drag ? { y: -6, scale: 1.08 } : { y: 0, scale: 1 }}
              className={cn(
                'grid size-14 place-items-center rounded-2xl',
                file ? 'bg-success-500 text-white' : 'bg-brand-50 text-brand-500',
              )}
            >
              {file ? <FileSpreadsheet className="size-7" /> : <CloudUpload className="size-7" />}
            </motion.span>
            {file ? (
              <>
                <p className="text-ink-900 mt-4 text-sm font-semibold">{file.name}</p>
                <p className="text-ink-500 text-xs">
                  {fmtNum(file.size / 1024 / 1024, 2)} MB · click to choose another
                </p>
              </>
            ) : (
              <>
                <p className="text-ink-900 mt-4 text-sm font-semibold">Drop the workbook here or click to browse</p>
                <p className="text-ink-500 text-xs">.xlsx or .xlsm · up to 20 MB</p>
              </>
            )}
            <input ref={input} type="file" accept=".xlsx,.xlsm" hidden onChange={(e) => pick(e.target.files?.[0])} />
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button size="lg" disabled={!file} loading={busy} onClick={upload}>
            Check the file <ArrowRight />
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="What happens next" />
        <ol className="space-y-4">
          {[
            ['Nothing is saved yet', "We read every row and check it against this plant's parameters and limits."],
            [
              'You review the report',
              'Errors, numbers stored as text, dates that already have a logsheet, unknown columns.',
            ],
            ['You choose and import', 'Skip bad rows, keep or overwrite existing days, confirm opening balances.'],
            ['Reports recalculate', 'Imported days count as submitted. PDFs are not generated for imported days.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="bg-brand-50 text-brand-500 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <div>
                <p className="text-ink-900 text-sm font-semibold">{t}</p>
                <p className="text-ink-500 text-xs">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Working({ title, text }: { title: string; text: string }) {
  return (
    <Card className="flex flex-col items-center py-16 text-center">
      <div className="relative">
        <motion.span
          className="bg-brand-500/15 absolute inset-0 rounded-3xl"
          animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
        <span className="bg-primary-btn relative grid size-20 place-items-center rounded-3xl text-white">
          <FileSpreadsheet className="size-9" />
        </span>
      </div>
      <p className="text-ink-900 mt-6 text-lg font-semibold">{title}</p>
      <p className="text-ink-500 mt-1 max-w-md text-sm">{text}</p>
      <div className="bg-muted-bg mt-6 h-1.5 w-64 overflow-hidden rounded-full">
        <motion.div
          className="bg-brand-500 h-full w-1/3 rounded-full"
          animate={{ x: ['-100%', '300%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <p className="text-ink-400 mt-3 inline-flex items-center gap-1.5 text-xs">
        <Loader2 className="size-3.5 animate-spin" /> You can leave this page — the import keeps running.
      </p>
    </Card>
  );
}

/** Review step: the dry-run report and the apply options (IMP-02…IMP-05). */
function ReviewStep({ job, onApplied }: { job: ImportJob; onApplied: () => void }) {
  const { plant } = usePlant();
  const r = job.report ?? {};
  const errors = r.errors ?? [];
  const conversions = r.conversions ?? [];
  const dups = r.duplicates ?? [];
  const unknown = r.unknownColumns ?? [];
  const sugg = r.suggestedOpenings;
  const hasOpenings = !!sugg?.asOf && (Object.keys(sugg.stock).length > 0 || sugg.cash !== null);
  const [tab, setTab] = useState<'errors' | 'conversions' | 'duplicates' | 'unknown'>(
    errors.length ? 'errors' : 'conversions',
  );
  const [skip, setSkip] = useState((r.errorRows ?? 0) > 0);
  const [existing, setExisting] = useState<'skip' | 'overwrite'>('skip');
  const [reason, setReason] = useState('');
  const [useOpenings, setUseOpenings] = useState(hasOpenings);
  const [openings, setOpenings] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(Object.entries(sugg?.stock ?? {}).map(([k, v]) => [k, String(Math.round(v * 100) / 100)])),
    ...(sugg?.cash !== null && sugg?.cash !== undefined ? { __cash: String(sugg.cash) } : {}),
  }));
  const [busy, setBusy] = useState(false);
  const toImport = (r.rows ?? 0) - (skip ? (r.errorRows ?? 0) : 0) - (existing === 'skip' ? dups.length : 0);
  const blocked =
    ((r.errorRows ?? 0) > 0 && !skip) ||
    (existing === 'overwrite' && reason.trim().length < 10) ||
    plant.setupStatus !== 'live';

  async function apply() {
    const body: ApplyBody = {
      skipErrorRows: skip,
      existing,
      reason: existing === 'overwrite' ? reason.trim() : undefined,
    };
    if (useOpenings && sugg?.asOf) {
      const stock = Object.fromEntries(
        Object.entries(openings)
          .filter(([k, v]) => k !== '__cash' && v.trim() !== '' && Number.isFinite(Number(v)))
          .map(([k, v]) => [k, Number(v)]),
      );
      body.openings = { stock, asOf: sugg.asOf, cash: openings.__cash ? Number(openings.__cash) : undefined };
    }
    setBusy(true);
    try {
      await clientApi.post(`/plants/${plant.id}/imports/${job.id}/apply`, body);
      onApplied();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={<Rows3 />}
          label="Days in the file"
          value={fmtNum(r.rows ?? 0)}
          sub={job.mapping === 'template' ? 'OMMIS template' : 'DATA ENTRY sheet'}
        />
        <Tile
          icon={<CalendarRange />}
          label="Date range"
          value={
            r.firstDate ? (
              <span className="block text-[15px] leading-snug">
                {fmtDate(r.firstDate)}
                <span className="text-ink-400 block text-xs font-normal">to {fmtDate(r.lastDate)}</span>
              </span>
            ) : (
              DASH
            )
          }
        />
        <Tile
          icon={<FileWarning />}
          tone={(r.errorRows ?? 0) ? 'danger' : 'success'}
          label="Rows with errors"
          value={fmtNum(r.errorRows ?? 0)}
          sub={`${errors.length} issue(s)`}
        />
        <Tile
          icon={<Copy />}
          tone={dups.length ? 'warning' : 'success'}
          label="Days already submitted"
          value={fmtNum(dups.length)}
          sub={unknown.length ? `${unknown.length} unknown column(s)` : 'all columns recognised'}
        />
      </div>

      <Card>
        <Tabs
          className="mb-5"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'errors', label: 'Errors', count: errors.length },
            { value: 'conversions', label: 'Converted', count: conversions.length },
            { value: 'duplicates', label: 'Existing days', count: dups.length },
            { value: 'unknown', label: 'Unknown columns', count: unknown.length },
          ]}
        />
        {tab === 'errors' || tab === 'conversions' ? (
          (tab === 'errors' ? errors : conversions).length === 0 ? (
            <EmptyState
              compact
              icon={<Check />}
              title={tab === 'errors' ? 'No errors' : 'Nothing converted'}
              description={tab === 'errors' ? 'Every row passed the checks.' : 'All numbers were stored as numbers.'}
            />
          ) : (
            <DataTable
              dense
              stickyHeader
              className="max-h-[420px] overflow-y-auto"
              rows={(tab === 'errors' ? errors : conversions).slice(0, 300)}
              rowKey={(e, i) => `${e.row}-${e.column}-${i}`}
              columns={[
                {
                  key: 'row',
                  header: 'Row',
                  width: '70px',
                  cell: (e) => <span className="tabular font-semibold">{e.row}</span>,
                },
                {
                  key: 'col',
                  header: 'Column',
                  width: '160px',
                  cell: (e) => <span className="font-mono text-[12px]">{e.code ?? e.column}</span>,
                },
                {
                  key: 'msg',
                  header: 'Problem',
                  cell: (e) => (
                    <span className={tab === 'errors' ? 'text-danger-600' : 'text-ink-700'}>{e.message}</span>
                  ),
                },
                {
                  key: 'val',
                  header: 'Value',
                  width: '140px',
                  align: 'right',
                  hideBelow: 'sm',
                  cell: (e) => (
                    <span className="text-ink-500 tabular">
                      {e.value === undefined || e.value === null ? DASH : String(e.value)}
                    </span>
                  ),
                },
              ]}
            />
          )
        ) : tab === 'duplicates' ? (
          dups.length === 0 ? (
            <EmptyState
              compact
              icon={<Check />}
              title="No overlap"
              description="None of these days has a submitted logsheet yet."
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {dups.slice(0, 400).map((d) => (
                <Badge key={d} tone="warning" size="md">
                  {fmtDate(d)}
                </Badge>
              ))}
            </div>
          )
        ) : unknown.length === 0 ? (
          <EmptyState
            compact
            icon={<Check />}
            title="All columns recognised"
            description="Every column matches a parameter of this plant."
          />
        ) : (
          <div>
            <p className="text-ink-500 mb-3 text-sm">
              These columns do not match any parameter code of this plant and are ignored:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {unknown.map((u) => (
                <span key={u} className="bg-muted-bg text-ink-700 rounded-md px-2 py-1 font-mono text-xs">
                  {u}
                </span>
              ))}
            </div>
          </div>
        )}
        {errors.length > 300 && tab === 'errors' && (
          <p className="text-ink-400 mt-3 text-xs">Showing the first 300 of {errors.length}.</p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Import options" />
          <div className="space-y-4">
            <div
              className={cn(
                'rounded-inner flex items-center justify-between gap-4 border p-4',
                (r.errorRows ?? 0) > 0 && !skip ? 'border-danger-100 bg-danger-50/50' : 'border-line',
              )}
            >
              <div>
                <p className="text-ink-900 text-sm font-semibold">Skip rows with errors</p>
                <p className="text-ink-500 text-xs">
                  {(r.errorRows ?? 0) > 0 ? `${r.errorRows} row(s) will not be imported.` : 'No row has errors.'}
                </p>
              </div>
              <Switch
                checked={skip}
                onCheckedChange={setSkip}
                disabled={(r.errorRows ?? 0) === 0}
                aria-label="Skip error rows"
              />
            </div>
            <div className="rounded-inner border-line border p-4">
              <p className="text-ink-900 text-sm font-semibold">Days that already have a logsheet</p>
              <p className="text-ink-500 mb-3 text-xs">
                {dups.length ? `${dups.length} day(s) overlap.` : 'No overlap with existing logsheets.'}
              </p>
              <Segmented
                size="sm"
                value={existing}
                onChange={setExisting}
                items={[
                  { value: 'skip', label: 'Keep existing' },
                  { value: 'overwrite', label: 'Overwrite', disabled: dups.length === 0 },
                ]}
              />
              <AnimatePresence>
                {existing === 'overwrite' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <Field
                      className="mt-4"
                      label="Reason"
                      required
                      hint="At least 10 characters — kept in the audit log."
                      error={reason && reason.trim().length < 10 ? 'Too short' : null}
                    >
                      <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Opening balances"
            subtitle={
              hasOpenings
                ? `Worked out from the first row · as of ${fmtDate(sugg!.asOf)}`
                : 'Not available for this file'
            }
            action={
              hasOpenings ? (
                <Switch checked={useOpenings} onCheckedChange={setUseOpenings} aria-label="Use opening balances" />
              ) : undefined
            }
          />
          {hasOpenings ? (
            <div
              className={cn(
                'grid gap-3 transition-opacity sm:grid-cols-2',
                !useOpenings && 'pointer-events-none opacity-40',
              )}
            >
              {Object.keys(sugg!.stock).map((k) => (
                <Field key={k} label={k.charAt(0) + k.slice(1).toLowerCase()}>
                  <Input
                    inputMode="decimal"
                    value={openings[k] ?? ''}
                    onChange={(e) => setOpenings({ ...openings, [k]: e.target.value })}
                  />
                </Field>
              ))}
              {'__cash' in openings && (
                <Field label="Site cash (₹)">
                  <Input
                    inputMode="decimal"
                    value={openings.__cash ?? ''}
                    onChange={(e) => setOpenings({ ...openings, __cash: e.target.value })}
                  />
                </Field>
              )}
            </div>
          ) : (
            <p className="text-ink-500 text-sm">
              Set opening balances in Plant settings → Chemicals & stock and Site cash.
            </p>
          )}
        </Card>
      </div>

      <Card className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 text-base font-semibold">
            {fmtNum(Math.max(0, toImport))} day{toImport === 1 ? '' : 's'} will be imported
          </p>
          <p className="text-ink-500 text-xs">
            {plant.setupStatus !== 'live'
              ? 'The plant must be live before importing — finish the go-live checklist.'
              : 'Imported logsheets count as submitted; the reports recalculate once at the end.'}
          </p>
        </div>
        <Button size="lg" onClick={apply} loading={busy} disabled={blocked || toImport <= 0}>
          Import {fmtNum(Math.max(0, toImport))} days <ArrowRight />
        </Button>
      </Card>
    </div>
  );
}

/** /plants/:id/imports[/:importId] — Excel import wizard (PRD §19.1, Client Admin). */
export function ImportWizard() {
  const { plant, can } = usePlant();
  const params = useParams<{ id?: string[] }>();
  const id = params.id?.[0] ?? null;
  const router = useRouter();
  const qc = useQueryClient();
  const signedIn = useClientAuth().status === 'authenticated';
  const q = useQuery({
    queryKey: qk.client.importJob(plant.id, id ?? ''),
    queryFn: () => clientApi.get<ImportJob>(`/plants/${plant.id}/imports/${id}`),
    enabled: signedIn && !!id,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === 'validating' || s === 'applying' ? 1500 : false;
    },
  });
  const job = q.data;
  const status = id ? (job?.status ?? 'validating') : null;
  const step = status === 'applied' ? 4 : stepOf(status);
  const applied = job?.status === 'applied';
  useEffect(() => {
    if (applied) invalidatePlantData(qc, plant.id); // the engine recalculated: refresh every view of the plant
  }, [applied, qc, plant.id]);
  const base = `/plants/${plant.id}`;

  const content = (() => {
    if (!can('imports.manage'))
      return (
        <Card>
          <EmptyState
            icon={<ShieldAlert />}
            title="Client Admins only"
            description="Ask your Client Admin to import historic logsheets."
          />
        </Card>
      );
    if (!id) return <UploadStep onUploaded={(newId) => router.replace(`${base}/imports/${newId}`)} />;
    if (q.isError)
      return (
        <Card>
          <EmptyState
            icon={<CircleAlert />}
            title="Import not found"
            description={errorMessage(q.error)}
            action={
              <Button asChild>
                <Link href={`${base}/imports`}>Start a new import</Link>
              </Button>
            }
          />
        </Card>
      );
    if (!job) return <Skeleton className="rounded-card h-80" />;
    if (job.status === 'validating')
      return (
        <Working
          title="Checking the workbook…"
          text="Reading every row and checking it against this plant's parameters, limits and existing logsheets."
        />
      );
    if (job.status === 'applying')
      return (
        <Working
          title="Importing logsheets…"
          text="Saving the days in batches. The MIS report and dashboard recalculate once at the end."
        />
      );
    if (job.status === 'failed')
      return (
        <Card>
          <EmptyState
            icon={<AlertTriangle />}
            title="The import stopped"
            description={job.report?.fatal ?? 'The workbook could not be processed.'}
            action={
              <Button asChild>
                <Link href={`${base}/imports`}>
                  <RotateCcw /> Try another file
                </Link>
              </Button>
            }
          />
        </Card>
      );
    if (job.status === 'applied') {
      const a = job.report?.applied;
      return (
        <Card className="flex flex-col items-center py-14 text-center">
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 15 }}
            className="bg-success-50 text-success-600 grid size-20 place-items-center rounded-full"
          >
            <Check className="size-10" />
          </motion.span>
          <p className="text-ink-900 mt-5 text-2xl font-semibold">{fmtNum(a?.inserted ?? 0)} logsheets imported</p>
          <p className="text-ink-500 mt-1 text-sm">
            {fmtNum(a?.skipped ?? 0)} existing day(s) kept · {fmtNum(a?.errorRowsSkipped ?? 0)} row(s) with errors
            skipped
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" asChild>
              <Link href={`${base}/logsheet`}>
                <ClipboardList /> Logsheet calendar
              </Link>
            </Button>
            <Button asChild>
              <Link href={`${base}/dashboard`}>
                <Gauge /> Open the dashboard
              </Link>
            </Button>
          </div>
        </Card>
      );
    }
    return <ReviewStep job={job} onApplied={() => void q.refetch()} />;
  })();

  return (
    <>
      <PageHeader
        title="Import from Excel"
        subtitle={`${plant.name} · bring past logsheets in from a workbook`}
        actions={
          id && job && job.status !== 'validating' && job.status !== 'applying' ? (
            <Button variant="secondary" asChild>
              <Link href={`${base}/imports`}>
                <CloudUpload /> New import
              </Link>
            </Button>
          ) : undefined
        }
        badge={job ? <Badge tone="neutral">{fmtDateTime(job.created_at)}</Badge> : undefined}
      />
      {can('imports.manage') && <Stepper step={step} failed={job?.status === 'failed'} />}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${id ?? 'new'}-${job?.status ?? ''}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
