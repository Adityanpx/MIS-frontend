'use client';

import {
  AlertTriangle,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  CircleDashed,
  CloudOff,
  FileDown,
  Gauge,
  History,
  Loader2,
  Lock,
  PencilLine,
  RefreshCw,
  Save,
  Send,
  Table2,
  TriangleAlert,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { DateNav } from '@/components/date/date-nav';
import { PageHeader } from '@/components/shell/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, Kbd, Skeleton } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { fmtDate, fmtDateTime, fmtMoney0, fmtNum } from '@/lib/format';
import { useModKey } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { weekday } from '../engine-ui';
import { usePlantPdf } from '../pdf';
import { usePlantDate } from '../plant-date';
import { usePlant } from '../plant-context';
import { blockIcon, LogsheetBlock, Ring } from './blocks';
import { CorrectionBar, focusField, HistoryDrawer, SubmitDialog, SubmittedDialog } from './dialogs';
import { cashPreview, staffPreview, stockPreview } from './form-engine';
import { useInvalidatePlantData, useLogCalendar, useLogForm } from './queries';
import { BLOCK_REASON_TEXT, SUBMITTED_STATUSES, type LogsheetForm, type SubmitResult } from './types';
import { useLogsheetEditor, type LogsheetEditor } from './use-logsheet-editor';

function SaveIndicator({ ed }: { ed: LogsheetEditor }) {
  const map: Record<string, { icon: ReactNode; text: string; cls: string }> = {
    clean: { icon: <CheckCircle2 />, text: 'No changes yet', cls: 'text-ink-500' },
    pending: { icon: <CircleDashed />, text: 'Unsaved changes…', cls: 'text-ink-500' },
    saving: { icon: <Loader2 className="animate-spin" />, text: 'Saving draft…', cls: 'text-brand-500' },
    saved: {
      icon: <CheckCircle2 />,
      text: `Draft saved${ed.savedAt ? ` · ${fmtDateTime(ed.savedAt).split(' ').pop()}` : ''}`,
      cls: 'text-success-600',
    },
    invalid: { icon: <TriangleAlert />, text: 'Fix the red values to save', cls: 'text-danger-600' },
    error: { icon: <CloudOff />, text: 'Not saved — retrying on next change', cls: 'text-danger-600' },
  };
  const s = map[ed.saveState]!;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={ed.saveState}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
        className={cn('inline-flex items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5', s.cls)}
      >
        {s.icon}
        {s.text}
      </motion.span>
    </AnimatePresence>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
  actions,
}: {
  tone: 'warning' | 'danger' | 'brand';
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const t = {
    warning: 'border-warning-100 bg-warning-50 [&_.ic]:bg-warning-500',
    danger: 'border-danger-100 bg-danger-50 [&_.ic]:bg-danger-500',
    brand: 'border-brand-100 bg-brand-50 [&_.ic]:bg-brand-500',
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex flex-wrap items-center gap-3 rounded-2xl border p-4', t)}
    >
      <span className="ic grid size-9 shrink-0 place-items-center rounded-xl text-white [&_svg]:size-[18px]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ink-900 text-sm font-semibold">{title}</p>
        {children && <p className="text-ink-700 text-[13px]">{children}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </motion.div>
  );
}

/** Right column: progress, save state, block checklist, quick look and the submit button. */
function EntrySide({ form, ed, onSubmit }: { form: LogsheetForm; ed: LogsheetEditor; onSubmit: () => void }) {
  const mod = useModKey();
  const pct = ed.progress.total ? Math.round((ed.progress.filled / ed.progress.total) * 100) : 100;
  const warnings = ed.fullChecks.warnings.length;
  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative grid place-items-center">
          <Ring value={ed.progress.filled} max={ed.progress.total} size={84} stroke={8} />
          <span className="text-ink-900 tabular absolute text-lg font-bold">{pct}%</span>
        </div>
        <div className="min-w-0">
          <p className="text-ink-900 text-base font-semibold">Today&apos;s entry</p>
          <p className="text-ink-500 text-xs">
            {ed.progress.filled} of {ed.progress.total} required values
          </p>
          <div className="mt-1.5">
            <SaveIndicator ed={ed} />
          </div>
        </div>
      </div>
      <ul className="space-y-1">
        {ed.progress.blocks.map((b) => {
          const Icon = blockIcon(b.block);
          const done = b.total === 0 || b.filled === b.total;
          const bad = form.blocks.find((x) => x.block === b.block)?.fields.some((f) => ed.errors[f.parameterId]);
          return (
            <li key={b.block}>
              <button
                type="button"
                onClick={() => document.getElementById(`block-${b.block}`)?.scrollIntoView({ behavior: 'smooth' })}
                className="hover:bg-canvas flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors"
              >
                <Icon className="text-ink-400 size-4 shrink-0" />
                <span className="text-ink-700 min-w-0 flex-1 truncate text-[13px] font-medium">{b.title}</span>
                {bad ? (
                  <span className="bg-danger-500 size-2 rounded-full" />
                ) : done ? (
                  <CheckCircle2 className="text-success-600 size-4" />
                ) : (
                  <span className="text-ink-500 tabular text-xs">
                    {b.filled}/{b.total}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {warnings > 0 && (
        <button
          type="button"
          onClick={() => focusField(ed.fullChecks.warnings[0]!.parameterId)}
          className="border-warning-100 bg-warning-50 flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left"
        >
          <TriangleAlert className="text-warning-500 size-4 shrink-0" />
          <span className="text-warning-600 text-[13px] font-medium">
            {warnings} value{warnings > 1 ? 's' : ''} outside the standard
          </span>
        </button>
      )}
      <div className="space-y-2">
        <Button className="w-full" size="lg" onClick={onSubmit}>
          <Send /> Review &amp; submit
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => void ed.saveNow()}
          disabled={ed.saveState === 'saving'}
        >
          <Save /> Save draft <Kbd className="ml-1">{mod} S</Kbd>
        </Button>
      </div>
    </Card>
  );
}

function AtAGlance({ form, ed }: { form: LogsheetForm; ed: LogsheetEditor }) {
  const cash = cashPreview(form, ed.byCode);
  const staff = staffPreview(form, ed.byCode);
  const stock = stockPreview(form, ed.byCode);
  const low = stock.filter((s) => s.state === 'low' || s.state === 'negative');
  const absent = staff.reduce((s, c) => s + Math.max(0, c.absent), 0);
  const rows = [
    {
      label: 'Cash in hand',
      value: fmtMoney0(cash.closing),
      tone: cash.overLimit ? 'text-warning-600' : 'text-ink-900',
    },
    { label: 'Staff absent', value: fmtNum(absent), tone: absent > 0 ? 'text-warning-600' : 'text-ink-900' },
    {
      label: 'Low stock',
      value: low.length ? low.map((s) => s.name).join(', ') : 'None',
      tone: low.length ? 'text-danger-600' : 'text-success-600',
    },
  ];
  return (
    <Card>
      <p className="text-ink-900 mb-3 text-sm font-semibold">At a glance</p>
      <dl className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 text-[13px]">
            <dt className="text-ink-500">{r.label}</dt>
            <dd className={cn('tabular truncate font-semibold', r.tone)}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function SubmittedSide({
  form,
  ed,
  plantId,
  onHistory,
  misHref,
  dashHref,
}: {
  form: LogsheetForm;
  ed: LogsheetEditor;
  plantId: string;
  onHistory: () => void;
  misHref: string;
  dashHref: string;
}) {
  const { can, plant } = usePlant();
  const pdf = usePlantPdf(plantId, can('pdf.generate'));
  const canHistory = plant.myRole !== 'viewer'; // GET /history: editor, checker, verifier, Client Admin
  const l = form.logsheet!;
  const canRequest = can('logsheet.requestCorrection') && !form.canCorrect;
  return (
    <Card className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="bg-success-50 text-success-600 grid size-11 place-items-center rounded-2xl">
          <CheckCircle2 className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-ink-900 text-base font-semibold">Submitted</p>
          <p className="text-ink-500 truncate text-xs">
            {l.submittedBy ?? '—'} · {fmtDateTime(l.submittedAt)}
          </p>
        </div>
      </div>
      <dl className="bg-canvas space-y-2 rounded-xl p-3.5 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-ink-500">Status</dt>
          <dd>
            <StatusBadge status={l.status} size="sm" />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-500">Version</dt>
          <dd className="text-ink-900 tabular font-semibold">{l.version}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-500">Source</dt>
          <dd className="text-ink-900 font-medium">{l.source === 'import' ? 'Excel import' : 'Entered online'}</dd>
        </div>
        {l.remarks && <p className="text-ink-700 border-line border-t pt-2 italic">&quot;{l.remarks}&quot;</p>}
      </dl>
      {ed.mode === 'view' && (
        <div className="space-y-2">
          {form.canCorrect && (
            <Button className="w-full" onClick={() => ed.setMode('correct')}>
              <PencilLine /> Correct values
            </Button>
          )}
          {canRequest && (
            <Button className="w-full" variant="soft" onClick={() => ed.setMode('request')}>
              <PencilLine /> Request a correction
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void pdf.download(form.date, 'logsheet')} loading={pdf.busy}>
              <FileDown /> PDF
            </Button>
            <Button variant="secondary" onClick={onHistory} disabled={!canHistory}>
              <History /> History
            </Button>
            <Button variant="secondary" asChild>
              <Link href={misHref}>
                <Table2 /> MIS
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={dashHref}>
                <Gauge /> Dashboard
              </Link>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function DaySkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        {[240, 320, 200].map((h, i) => (
          <Skeleton key={i} className="rounded-card" style={{ height: h }} />
        ))}
      </div>
      <Skeleton className="rounded-card h-[420px]" />
    </div>
  );
}

/** One day's logsheet: entry with autosave, or the submitted values with corrections. */
export function LogsheetDay({ date }: { date: string }) {
  const { plant, can, readOnly } = usePlant();
  const pd = usePlantDate('logsheet');
  const q = useLogForm(plant.id, date);
  const form = q.data;
  const ed = useLogsheetEditor({ plantId: plant.id, form, readOnly, refetch: q.refetch });
  const cal = useLogCalendar(plant.id, date.slice(0, 7));
  const invalidate = useInvalidatePlantData();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const status = form?.logsheet?.status ?? (form?.rule.allowed ? 'missing' : null);
  const submitted = !!form?.logsheet && SUBMITTED_STATUSES.includes(form.logsheet.status);
  const nextMissing = useMemo(
    () => cal.data?.days.find((d) => d.date !== date && (d.status === 'missing' || d.status === 'draft'))?.date ?? null,
    [cal.data, date],
  );

  async function afterSubmit(r: SubmitResult) {
    setResult(r);
    invalidate(plant.id);
    await ed.reload(false);
  }
  async function afterChange(kind: 'correct' | 'request') {
    if (kind === 'correct') {
      toast.success('Correction saved', { description: 'Reports from this date onwards are being recalculated.' });
      invalidate(plant.id);
    } else {
      toast.success('Correction request sent', { description: 'Your Client Admin will review it.' });
    }
    await ed.reload(false);
  }

  const header = (
    <PageHeader
      title="Daily logsheet"
      badge={status ? <StatusBadge status={status} /> : undefined}
      subtitle={`${plant.name} · ${weekday(date)}, ${fmtDate(date)}`}
      actions={
        <>
          <Button variant="secondary" asChild>
            <Link href={pd.hrefFor('logsheet', null)}>
              <CalendarDays /> Calendar
            </Link>
          </Button>
          <DateNav value={date} onChange={pd.setDate} min={pd.min} max={pd.max} />
        </>
      }
    />
  );

  if (q.isLoading)
    return (
      <>
        {header}
        <DaySkeleton />
      </>
    );
  if (q.isError || !form) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<CloudOff />}
            title="Could not open this logsheet"
            description={errorMessage(q.error)}
            action={<Button onClick={() => q.refetch()}>Try again</Button>}
          />
        </Card>
      </>
    );
  }
  if (!form.rule.allowed && !form.logsheet) {
    const r = BLOCK_REASON_TEXT[form.rule.reason ?? 'FUTURE_DATE'];
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<CalendarX2 />}
            title={r.title}
            description={r.text}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" asChild>
                  <Link href={pd.hrefFor('logsheet', null)}>Open the calendar</Link>
                </Button>
                {nextMissing && (
                  <Button asChild>
                    <Link href={pd.hrefFor('logsheet', nextMissing)}>Go to {fmtDate(nextMissing)}</Link>
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      </>
    );
  }

  const misHref = pd.hrefFor('mis', date);
  const dashHref = pd.hrefFor('dashboard', date);
  const progressByBlock = new Map(ed.progress.blocks.map((b) => [b.block, b]));

  return (
    <>
      {header}
      <div
        className={cn(
          'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]',
          ed.mode === 'entry' && 'pb-24 lg:pb-0',
        )}
      >
        <div className="min-w-0 space-y-6">
          {readOnly && ed.mode === 'view' && !submitted && (
            <Banner tone="warning" icon={<Lock />} title="The account is read-only">
              Logsheets can be viewed but not changed until the account is active again.
            </Banner>
          )}
          {ed.lock.kind === 'other' && (
            <Banner
              tone="warning"
              icon={<Lock />}
              title={`${ed.lock.byName ?? 'Another user'} is editing this logsheet`}
              actions={
                <Button size="sm" variant="secondary" onClick={() => void ed.reload(false)}>
                  <RefreshCw /> Check again
                </Button>
              }
            >
              {ed.lock.until ? `Their edit lock ends at ${fmtDateTime(ed.lock.until).split(' ').pop()}. ` : ''}
              You can view the values; editing opens when they finish.
            </Banner>
          )}
          {ed.conflict && (
            <Banner
              tone="danger"
              icon={<AlertTriangle />}
              title="This logsheet changed somewhere else"
              actions={
                <>
                  <Button size="sm" variant="secondary" onClick={() => void ed.reload(false)}>
                    Discard mine
                  </Button>
                  <Button size="sm" onClick={() => void ed.reload(true)}>
                    Reload, keep my values
                  </Button>
                </>
              }
            >
              Another tab or user saved a newer version. Reload to continue.
            </Banner>
          )}
          {form.blocks.map((b) => (
            <LogsheetBlock key={b.block} form={form} block={b} ed={ed} prog={progressByBlock.get(b.block)} />
          ))}
          <AnimatePresence>
            {(ed.mode === 'correct' || ed.mode === 'request') && (
              <CorrectionBar ed={ed} form={form} onDone={(k) => void afterChange(k)} />
            )}
          </AnimatePresence>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-[96px]">
          {submitted ? (
            <SubmittedSide
              form={form}
              ed={ed}
              plantId={plant.id}
              onHistory={() => setHistoryOpen(true)}
              misHref={misHref}
              dashHref={dashHref}
            />
          ) : ed.mode === 'entry' ? (
            <EntrySide form={form} ed={ed} onSubmit={() => setSubmitOpen(true)} />
          ) : null}
          <AtAGlance form={form} ed={ed} />
        </aside>
      </div>

      {/* phones: progress + submit always reachable */}
      {ed.mode === 'entry' && (
        <div className="border-line bg-surface/95 shadow-float fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-2xl border p-2.5 pl-4 backdrop-blur lg:hidden">
          <div className="relative grid place-items-center">
            <Ring value={ed.progress.filled} max={ed.progress.total} size={34} stroke={4} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-ink-900 text-[13px] font-semibold">
              {ed.progress.filled}/{ed.progress.total} values
            </p>
            <SaveIndicator ed={ed} />
          </div>
          <Button onClick={() => setSubmitOpen(true)}>
            <Send /> Submit
          </Button>
        </div>
      )}

      {ed.mode === 'entry' && (
        <SubmitDialog
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          form={form}
          ed={ed}
          onSubmitted={(r) => void afterSubmit(r)}
        />
      )}
      <SubmittedDialog
        result={result}
        onClose={() => setResult(null)}
        form={form}
        plantId={plant.id}
        canGenerate={can('pdf.generate')}
        misHref={misHref}
        nextHref={nextMissing ? pd.hrefFor('logsheet', nextMissing) : null}
      />
      {submitted && <HistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} plantId={plant.id} date={date} />}
    </>
  );
}
