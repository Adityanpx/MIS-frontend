'use client';

import { AlertTriangle, CheckCircle2, FileDown, History, Send, Table2, X } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { errorMessage, hasCode } from '@/lib/api';
import { DASH, fmtDate, fmtDateTime, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePlantPdf } from '../pdf';
import { allFields } from './form-engine';
import { useLogHistory } from './queries';
import type { FieldIssue, HistoryRow, LogsheetForm, SubmitResult } from './types';
import type { LogsheetEditor } from './use-logsheet-editor';

/** Scrolls to a field and focuses its input (used by every "jump to" link). */
export function focusField(parameterId: string) {
  const el = document.getElementById(`f-${parameterId}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => (document.getElementById(`in-${parameterId}`) as HTMLInputElement | null)?.focus(), 350);
}

function IssueList({
  items,
  tone,
  onPick,
}: {
  items: Array<{ id: string; title: string; message: string }>;
  tone: 'danger' | 'warning';
  onPick?: (id: string) => void;
}) {
  return (
    <ul className="scrollbar-thin max-h-64 space-y-1.5 overflow-y-auto pr-1">
      {items.map((i, n) => (
        <li key={`${i.id}-${n}`}>
          <button
            type="button"
            disabled={!onPick || !i.id}
            onClick={() => onPick?.(i.id)}
            className={cn(
              'rounded-inner flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors',
              tone === 'danger' ? 'bg-danger-50 hover:bg-danger-100' : 'bg-warning-50 hover:bg-warning-100',
            )}
          >
            <span
              className={cn(
                'mt-1.5 size-1.5 shrink-0 rounded-full',
                tone === 'danger' ? 'bg-danger-500' : 'bg-warning-500',
              )}
            />
            <span className="min-w-0">
              <span className="text-ink-900 block text-[13px] font-semibold">{i.title}</span>
              <span className={cn('block text-xs', tone === 'danger' ? 'text-danger-600' : 'text-warning-600')}>
                {i.message}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Confirm-and-submit (LOG-15): blocks on hard errors, lists soft warnings, optional remark. */
export function SubmitDialog({
  open,
  onOpenChange,
  form,
  ed,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: LogsheetForm;
  ed: LogsheetEditor;
  onSubmitted: (r: SubmitResult) => void;
}) {
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const names = new Map(allFields(form).map((f) => [f.parameterId, f.name]));
  const errors = Object.entries({ ...ed.fullChecks.errors, ...ed.serverErrors }).map(([id, message]) => ({
    id,
    title: names.get(id) ?? 'Value',
    message,
  }));
  const warnings = ed.fullChecks.warnings.map((w) => ({
    id: w.parameterId,
    title: names.get(w.parameterId) ?? w.code,
    message: w.message,
  }));
  const pick = (id: string) => {
    onOpenChange(false);
    focusField(id);
  };

  async function go() {
    setBusy(true);
    try {
      const r = await ed.submit(remarks.trim() || undefined);
      onOpenChange(false);
      setRemarks('');
      onSubmitted(r);
    } catch (e) {
      if (hasCode(e, 'VALIDATION_FAILED'))
        toast.error('Some values were refused', { description: 'They are highlighted on the form.' });
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (errors.length) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        tone="danger"
        icon={<AlertTriangle />}
        title={`${errors.length} value${errors.length > 1 ? 's' : ''} need${errors.length > 1 ? '' : 's'} attention`}
        description="Fix these before submitting. Click one to jump to it."
        footer={
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Back to the form
          </Button>
        }
      >
        <IssueList items={errors} tone="danger" onPick={pick} />
      </Modal>
    );
  }
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      icon={<Send />}
      size="lg"
      title={`Submit the logsheet for ${fmtDate(form.date)}?`}
      description="After submission the values are final: only your Client Admin can correct them, with a reason."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Keep editing
          </Button>
          <Button onClick={go} loading={busy}>
            <Send /> Submit logsheet
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Required values', value: `${ed.progress.filled}/${ed.progress.total}`, tone: 'text-success-600' },
            {
              label: 'Warnings',
              value: String(warnings.length),
              tone: warnings.length ? 'text-warning-600' : 'text-ink-900',
            },
            { label: 'Draft version', value: String(ed.version), tone: 'text-ink-900' },
          ].map((s) => (
            <div key={s.label} className="rounded-inner bg-canvas p-3">
              <p className="text-ink-400 text-[11px] font-medium tracking-wider uppercase">{s.label}</p>
              <p className={cn('tabular mt-1 text-xl font-bold', s.tone)}>{s.value}</p>
            </div>
          ))}
        </div>
        {warnings.length > 0 && (
          <div>
            <p className="text-ink-700 mb-2 text-[13px] font-semibold">
              Outside the standard — check before submitting (allowed)
            </p>
            <IssueList items={warnings} tone="warning" onPick={pick} />
          </div>
        )}
        <Field label="Note for the record" hint="Optional. Shown on the logsheet PDF and in the audit log.">
          <Textarea rows={3} value={remarks} maxLength={1000} onChange={(e) => setRemarks(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/** Shown after a successful submit: next steps + the warnings the API recorded. */
export function SubmittedDialog({
  result,
  onClose,
  form,
  plantId,
  canGenerate,
  misHref,
  nextHref,
}: {
  result: SubmitResult | null;
  onClose: () => void;
  form: LogsheetForm;
  plantId: string;
  canGenerate: boolean;
  misHref: string;
  nextHref: string | null;
}) {
  const pdf = usePlantPdf(plantId, canGenerate);
  const names = new Map(allFields(form).map((f) => [f.parameterId, f.name]));
  const warnings = (result?.warnings ?? []).map((w: FieldIssue) => ({
    id: w.parameterId,
    title: names.get(w.parameterId) ?? w.code,
    message: w.message,
  }));
  return (
    <Modal
      open={!!result}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={<span className="sr-only">Logsheet submitted</span>}
    >
      <div className="-mt-4 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="bg-success-50 text-success-600 grid size-20 place-items-center rounded-full"
        >
          <motion.span initial={{ rotate: -30 }} animate={{ rotate: 0 }} transition={{ delay: 0.1 }}>
            <CheckCircle2 className="size-11" strokeWidth={1.8} />
          </motion.span>
        </motion.div>
        <h3 className="text-ink-900 mt-4 text-xl font-semibold">Logsheet submitted</h3>
        <p className="text-ink-500 mt-1 text-sm">
          {fmtDate(form.date)} · version {result?.version}. The MIS report and dashboard update in a few seconds.
        </p>
      </div>
      {warnings.length > 0 && (
        <div className="mt-5">
          <p className="text-ink-700 mb-2 text-[13px] font-semibold">Recorded as events ({warnings.length})</p>
          <IssueList items={warnings} tone="warning" />
        </div>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => void pdf.download(form.date, 'logsheet')} loading={pdf.busy}>
          <FileDown /> Logsheet PDF
        </Button>
        <Button variant="secondary" asChild>
          <Link href={misHref}>
            <Table2 /> Open MIS report
          </Link>
        </Button>
        {nextHref ? (
          <Button asChild className="sm:col-span-2">
            <Link href={nextHref} onClick={onClose}>
              Fill the next missing day
            </Link>
          </Button>
        ) : (
          <Button className="sm:col-span-2" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </Modal>
  );
}

const numOrText = (n: HistoryRow['old_num'], t: string | null) =>
  n !== null && n !== undefined ? fmtNum(Number(n)) : t !== null && t !== '' ? t : DASH;

/** Value history of a submitted logsheet (LOG-18): one group per version. */
export function HistoryDrawer({
  open,
  onOpenChange,
  plantId,
  date,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  plantId: string;
  date: string;
}) {
  const q = useLogHistory(plantId, date, open);
  const groups = new Map<number, HistoryRow[]>();
  for (const r of q.data ?? []) groups.set(r.version, [...(groups.get(r.version) ?? []), r]);
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Change history"
      description={`Every corrected value of ${fmtDate(date)}, newest first.`}
    >
      {q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="rounded-inner h-28" />
          ))}
        </div>
      ) : !q.data?.length ? (
        <EmptyState
          icon={<History />}
          title="No corrections"
          description="The values are exactly as submitted."
          compact
        />
      ) : (
        <ol className="border-line relative ml-3 space-y-6 border-l pl-6">
          {[...groups.entries()].map(([version, rows]) => (
            <li key={version} className="relative">
              <span className="bg-brand-500 ring-surface absolute top-1 -left-[31px] size-3 rounded-full ring-4" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand" size="sm">
                  Version {version}
                </Badge>
                <span className="text-ink-500 text-xs">
                  {rows[0]?.changed_by ?? 'System'} · {fmtDateTime(rows[0]?.changed_at)}
                </span>
              </div>
              <p className="rounded-inner bg-canvas text-ink-700 mt-2 px-3 py-2 text-[13px] italic">
                “{rows[0]?.reason}”
              </p>
              <ul className="mt-2 space-y-1.5">
                {rows.map((r) => (
                  <li key={r.code} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-ink-700 min-w-0 truncate">{r.name}</span>
                    <span className="tabular flex shrink-0 items-center gap-2">
                      <span className="text-ink-400 line-through">{numOrText(r.old_num, r.old_text)}</span>
                      <span className="text-ink-300">→</span>
                      <span className="text-ink-900 font-semibold">{numOrText(r.new_num, r.new_text)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

/** Sticky bar while correcting (Client Admin) or requesting a correction (Editor). */
export function CorrectionBar({
  ed,
  form,
  onDone,
}: {
  ed: LogsheetEditor;
  form: LogsheetForm;
  onDone: (kind: 'correct' | 'request') => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const isCorrect = ed.mode === 'correct';
  const names = new Map(allFields(form).map((f) => [f.parameterId, f.name]));
  const blocking = Object.keys(ed.fullChecks.errors).length;
  const short = reason.trim().length < 10;

  async function go() {
    setBusy(true);
    try {
      await ed.submitChange(reason.trim());
      setOpen(false);
      setReason('');
      onDone(isCorrect ? 'correct' : 'request');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="border-brand-200 bg-surface/95 shadow-float sticky bottom-4 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-2xl border p-3 pl-5 backdrop-blur"
      >
        <span className="bg-brand-50 text-brand-500 grid size-9 place-items-center rounded-xl">
          <History className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ink-900 text-sm font-semibold">
            {isCorrect ? 'Correcting a submitted logsheet' : 'Requesting a correction'}
          </p>
          <p className="text-ink-500 text-xs">
            {ed.changes.length === 0
              ? 'Change the values that are wrong — changed boxes turn blue.'
              : `${ed.changes.length} value${ed.changes.length > 1 ? 's' : ''} changed`}
            {blocking > 0 && <span className="text-danger-600"> · {blocking} error(s) to fix</span>}
          </p>
        </div>
        <Button variant="ghost" onClick={() => ed.setMode('view')}>
          <X /> Cancel
        </Button>
        <Button disabled={ed.changes.length === 0 || blocking > 0} onClick={() => setOpen(true)}>
          {isCorrect ? 'Save correction' : 'Send request'}
        </Button>
      </motion.div>
      <Modal
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        icon={<History />}
        size="lg"
        title={isCorrect ? 'Save the correction' : 'Send the correction request'}
        description={
          isCorrect
            ? 'The MIS, dashboard and reports from this date onwards are recalculated, and the archived PDFs are marked out of date.'
            : 'Your Client Admin reviews the change and approves or rejects it. You are notified either way.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={go} loading={busy} disabled={short}>
              {isCorrect ? 'Save correction' : 'Send request'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ul className="rounded-inner border-line divide-line divide-y border">
            {ed.changes.map((c) => {
              const before = form.values[c.parameterId];
              return (
                <li key={c.parameterId} className="flex items-center justify-between gap-3 px-3.5 py-2 text-[13px]">
                  <span className="text-ink-700 min-w-0 truncate">{names.get(c.parameterId)}</span>
                  <span className="tabular flex shrink-0 items-center gap-2">
                    <span className="text-ink-400 line-through">
                      {before === undefined ? DASH : typeof before === 'number' ? fmtNum(before) : before}
                    </span>
                    <span className="text-ink-300">→</span>
                    <span className="text-brand-600 font-semibold">
                      {c.value === null ? DASH : typeof c.value === 'number' ? fmtNum(c.value) : c.value}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <Field
            label="Reason"
            required
            hint="At least 10 characters. Stored with every changed value and shown in the history."
            error={reason.length > 0 && short ? 'Please give a reason (at least 10 characters)' : null}
          >
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
