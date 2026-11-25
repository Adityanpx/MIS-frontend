'use client';

import {
  AlertTriangle, ArrowRight, CheckCircle2, Download, FileSpreadsheet, FileUp, Loader2, UploadCloud, X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { errorMessage } from '@/lib/api';
import { addDays, isValidISODate, todayIST } from '@/lib/dates';
import { fmtDate, fmtDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePlant } from '../plant-context';
import { importApi, invalidatePlantData } from './queries';
import type {
  ImportConflictPolicy, ImportConflictRow, ImportIssue, ImportPreview, ImportResult,
} from './types';

type Step = 'range' | 'upload' | 'preview' | 'done';

/** Compacts a sorted list of ISO dates into "15-Nov to 20-Nov, 25-Nov" for the UI. */
function compactDateRanges(dates: string[]): string {
  if (dates.length === 0) return '';
  const sorted = [...new Set(dates)].sort();
  const out: string[] = [];
  let runStart: string | null = null;
  let runEnd: string | null = null;
  const flush = () => {
    if (!runStart || !runEnd) return;
    out.push(runStart === runEnd ? fmtDay(runStart) : `${fmtDay(runStart)} → ${fmtDay(runEnd)}`);
  };
  for (const d of sorted) {
    if (runEnd && addDays(runEnd, 1) === d) { runEnd = d; continue; }
    flush();
    runStart = d; runEnd = d;
  }
  flush();
  return out.join(', ');
}

/** Groups issues by (code+name+message) so "missing Chemical-X from 05 → 09" collapses to one line. */
function groupIssues(items: ImportIssue[]): Array<{ title: string; message: string; dates: string[] }> {
  const by = new Map<string, { title: string; message: string; dates: string[] }>();
  for (const i of items) {
    const key = `${i.code}|${i.message}`;
    const entry = by.get(key);
    if (entry) entry.dates.push(i.date);
    else by.set(key, { title: i.name, message: i.message, dates: [i.date] });
  }
  return [...by.values()].sort((a, b) => b.dates.length - a.dates.length || a.title.localeCompare(b.title));
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { plant } = usePlant();
  const qc = useQueryClient();

  // Sensible default: last 7 days up to today, clipped to the plant's O&M window.
  const today = todayIST();
  const defTo = plant.omEnd < today ? plant.omEnd : today;
  const defFrom = (() => {
    const back = addDays(defTo, -6);
    return back < plant.misStart ? plant.misStart : back;
  })();

  const [step, setStep] = useState<Step>('range');
  const [from, setFrom] = useState(defFrom);
  const [to, setTo] = useState(defTo);
  const [file, setFile] = useState<File | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [conflict, setConflict] = useState<ImportConflictPolicy>('use_excel');
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rangeError = useMemo(() => {
    if (!isValidISODate(from) || !isValidISODate(to)) return 'Enter valid dates.';
    if (from > to) return '"From" must be on or before "To".';
    if (from < plant.misStart || to > plant.omEnd) {
      return `Range must stay inside the O&M window (${fmtDate(plant.misStart)} → ${fmtDate(plant.omEnd)}).`;
    }
    if (to > today) return 'A logsheet cannot be imported for a future date.';
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    if (days > 400) return 'Please keep the range to 400 days or fewer.';
    return null;
  }, [from, to, plant.misStart, plant.omEnd, today]);

  function reset(close: boolean) {
    setStep('range');
    setFile(null);
    setPreview(null);
    setResult(null);
    setConflict('use_excel');
    if (close) onOpenChange(false);
  }

  async function onDownloadTemplate() {
    if (rangeError) return;
    setDownloading(true);
    try {
      await importApi.downloadTemplate(plant.id, from, to);
      toast.success('Template downloaded. Fill it, then upload it here.');
      setStep('upload');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    setPreview(null);
    try {
      const p = await importApi.preview(plant.id, file, from, to);
      setPreview(p);
      setStep('preview');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    if (!file || !preview?.ok) return;
    setSaving(true);
    try {
      const r = await importApi.run(plant.id, file, from, to, conflict);
      setResult(r);
      setStep('done');
      invalidatePlantData(qc, plant.id);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : reset(true))}
      title={
        <span className="inline-flex items-center gap-2">
          <FileSpreadsheet className="size-5" /> Import logsheet data from Excel
        </span>
      }
      description={
        step === 'range'
          ? 'Pick a date range, download the template, fill it offline, then come back and upload it.'
          : step === 'upload'
            ? 'Upload the template you filled in — nothing is saved until you review the preview.'
            : step === 'preview'
              ? preview?.ok
                ? 'Looks clean. Review the summary and save.'
                : 'Fix the highlighted cells in the file and upload it again — nothing has been saved.'
              : 'Done.'
      }
      size="xl"
    >
      {/* ──────── STEP: Range + download ──────── */}
      {step === 'range' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" required>
              <Input
                type="date"
                value={from}
                min={plant.misStart}
                max={plant.omEnd}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="To" required>
              <Input
                type="date"
                value={to}
                min={plant.misStart}
                max={plant.omEnd}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          {rangeError && (
            <p className="text-danger-600 text-sm">{rangeError}</p>
          )}
          <div className="rounded-xl bg-canvas p-4">
            <h4 className="text-ink-900 text-sm font-semibold">How it works</h4>
            <ol className="text-ink-700 mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>Download the template — it has one row per date and columns for every value you type.</li>
              <li>Fill it in Excel. The <em>Std</em> row under each column heading shows the expected standard.</li>
              <li>Upload the filled file here. We check every row before anything is saved.</li>
            </ol>
          </div>
          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => reset(true)}>Cancel</Button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={onDownloadTemplate}
                disabled={!!rangeError || downloading}
              >
                {downloading ? <Loader2 className="animate-spin" /> : <Download />}
                Download template
              </Button>
              <Button
                onClick={() => setStep('upload')}
                disabled={!!rangeError}
              >
                I already have the file <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ──────── STEP: Upload ──────── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="text-ink-600 text-sm">
            Range: <strong className="text-ink-900">{fmtDate(from)} → {fmtDate(to)}</strong>
          </div>
          <label
            className={cn(
              'flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
              file ? 'border-brand-400 bg-brand-50/50' : 'border-line hover:border-brand-300 hover:bg-brand-50/30',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <FileSpreadsheet className="text-brand-500 size-9" />
                <p className="text-ink-900 text-sm font-semibold">{file.name}</p>
                <p className="text-ink-500 text-xs">
                  {(file.size / 1024).toFixed(1)} KB · click to replace
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="text-ink-400 size-9" />
                <p className="text-ink-700 text-sm font-semibold">Click to pick the filled .xlsx file</p>
                <p className="text-ink-500 text-xs">Only the template downloaded for this plant is accepted.</p>
              </>
            )}
          </label>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStep('range')}>Back</Button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onDownloadTemplate} disabled={downloading}>
                {downloading ? <Loader2 className="animate-spin" /> : <Download />}
                Download template again
              </Button>
              <Button onClick={onUpload} disabled={!file || uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <FileUp />}
                Check file
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ──────── STEP: Preview ──────── */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          <SummaryStrip preview={preview} />

          {/* Errors — grouped by column */}
          {preview.errors.length > 0 && (
            <IssueSection
              tone="danger"
              icon={<AlertTriangle />}
              title={`${preview.errors.length} problem${preview.errors.length === 1 ? '' : 's'} to fix in the file`}
              items={groupIssues(preview.errors)}
            />
          )}

          {/* Warnings — informational */}
          {preview.warnings.length > 0 && (
            <IssueSection
              tone="warning"
              icon={<AlertTriangle />}
              title={`${preview.warnings.length} warning${preview.warnings.length === 1 ? '' : 's'} (will still be saved)`}
              items={groupIssues(preview.warnings)}
            />
          )}

          {/* Conflicts: days that already exist */}
          {preview.ok && preview.conflicts.length > 0 && (
            <ConflictSection
              conflicts={preview.conflicts}
              value={conflict}
              onChange={setConflict}
            />
          )}

          {/* Clean — nothing to warn about */}
          {preview.ok && preview.conflicts.length === 0 && preview.warnings.length === 0 && (
            <EmptyState
              compact
              icon={<CheckCircle2 />}
              title="All clean"
              description={`${preview.rowsReady} day(s) ready to save.`}
            />
          )}

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="ghost" onClick={() => { setPreview(null); setStep('upload'); }}>
              Back
            </Button>
            {preview.ok ? (
              <Button onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Save {preview.rowsReady} day{preview.rowsReady === 1 ? '' : 's'}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => { setPreview(null); setFile(null); setStep('upload'); }}>
                <X /> Upload a fixed file
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ──────── STEP: Done ──────── */}
      {step === 'done' && result && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-success-50 p-4">
            <CheckCircle2 className="text-success-600 size-6" />
            <div className="flex-1">
              <p className="text-ink-900 text-sm font-semibold">Import complete</p>
              <p className="text-ink-600 text-xs">
                {result.inserted} new, {result.corrected} rewritten, {result.skipped} skipped.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={() => reset(true)}>Close</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ────────────────────────────────────────────────────────── bits

function SummaryStrip({ preview }: { preview: ImportPreview }) {
  const tiles: Array<{ label: string; value: number; tone: 'brand' | 'success' | 'danger' | 'warning' }> = [
    { label: 'Rows read', value: preview.rows, tone: 'brand' },
    { label: 'Ready to save', value: preview.rowsReady, tone: 'success' },
    { label: 'Errors', value: preview.errors.length, tone: 'danger' },
    { label: 'Warnings', value: preview.warnings.length, tone: 'warning' },
  ];
  const toneClass: Record<string, string> = {
    brand: 'bg-canvas',
    success: 'bg-success-50 text-success-700',
    danger: 'bg-danger-50 text-danger-700',
    warning: 'bg-warning-50 text-warning-700',
  };
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className={cn('rounded-xl p-3', toneClass[t.tone])}>
          <p className="text-xs opacity-80">{t.label}</p>
          <p className="tabular text-xl font-semibold">{t.value}</p>
        </div>
      ))}
    </div>
  );
}

function IssueSection({
  tone, icon, title, items,
}: {
  tone: 'danger' | 'warning';
  icon: React.ReactNode;
  title: string;
  items: Array<{ title: string; message: string; dates: string[] }>;
}) {
  return (
    <div className={cn('rounded-xl border p-3', tone === 'danger' ? 'border-danger-200 bg-danger-50/40' : 'border-warning-200 bg-warning-50/40')}>
      <div className="mb-2 flex items-center gap-2">
        <span className={tone === 'danger' ? 'text-danger-600' : 'text-warning-600'}>{icon}</span>
        <p className="text-ink-900 text-sm font-semibold">{title}</p>
      </div>
      <ul className="scrollbar-thin max-h-48 space-y-1.5 overflow-y-auto pr-1">
        {items.map((i, n) => (
          <li
            key={`${i.title}-${n}`}
            className={cn('rounded-inner px-3 py-2 text-sm', tone === 'danger' ? 'bg-danger-50' : 'bg-warning-50')}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-ink-900 font-semibold">{i.title}</span>
              <span className={cn('tabular shrink-0 text-xs', tone === 'danger' ? 'text-danger-600' : 'text-warning-600')}>
                {i.dates.length} day{i.dates.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className={cn('text-xs', tone === 'danger' ? 'text-danger-600' : 'text-warning-600')}>
              {i.message}
            </div>
            <div className="text-ink-500 tabular mt-0.5 text-xs">{compactDateRanges(i.dates)}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConflictSection({
  conflicts, value, onChange,
}: {
  conflicts: ImportConflictRow[];
  value: ImportConflictPolicy;
  onChange: (v: ImportConflictPolicy) => void;
}) {
  const dates = conflicts.map((c) => c.date);
  return (
    <div className="rounded-xl border border-warning-200 bg-warning-50/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="text-warning-600 size-4" />
        <p className="text-ink-900 text-sm font-semibold">
          {conflicts.length} day{conflicts.length === 1 ? '' : 's'} already have data
        </p>
      </div>
      <p className="text-ink-600 tabular mb-3 text-xs">{compactDateRanges(dates)}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <PolicyCard
          selected={value === 'use_excel'}
          onClick={() => onChange('use_excel')}
          title="Use the Excel values"
          body="The existing data for these days is replaced. The change is kept in each day's history."
        />
        <PolicyCard
          selected={value === 'keep_existing'}
          onClick={() => onChange('keep_existing')}
          title="Keep existing data"
          body="The Excel rows for these days are ignored. Other days in the file are still saved."
        />
      </div>
    </div>
  );
}

function PolicyCard({
  selected, onClick, title, body,
}: {
  selected: boolean; onClick: () => void; title: string; body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-left transition-all',
        selected ? 'border-brand-500 bg-brand-50/60 ring-brand-500/30 ring-2' : 'border-line bg-surface hover:border-brand-300',
      )}
    >
      <p className="text-ink-900 text-sm font-semibold">{title}</p>
      <p className="text-ink-600 mt-1 text-xs">{body}</p>
    </button>
  );
}
