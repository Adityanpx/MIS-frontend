'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ZodType } from 'zod';
import { DateField } from '@/components/date/date-field';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { adminApi, errorMessage, fieldErrors, isApiError, type Query } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth/admin-auth';
import { DASH, fmtMoney } from '@/lib/format';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { INDIAN_STATES } from '@/shared/indian-states';
import type { AdminClient } from './types';

/**
 * Super Admin data kit (File 5). Every admin read goes through `useA` / `useAList` (key = path + query),
 * every write through `useRun` (toast + refresh of the whole admin cache). Only `adminApi` is used here.
 */
const useSignedIn = () => useAdminAuth().status === 'authenticated';

export function useA<T>(path: string | null, query?: Query, opts: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: qk.admin.r(path ?? '', query),
    queryFn: () => adminApi.get<T>(path!, { query }),
    enabled: useSignedIn() && !!path,
    placeholderData: keepPreviousData,
    refetchInterval: opts.refetchInterval,
  });
}

export function useAList<T>(path: string, query: Query) {
  return useQuery({
    queryKey: qk.admin.r(`${path}#list`, query),
    queryFn: () => adminApi.list<T>(path, query),
    enabled: useSignedIn(),
    placeholderData: keepPreviousData,
  });
}

/** Runs one write; on success toasts and refreshes every admin query (lists, details, dashboard). */
export function useRun() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  async function run<R>(key: string, fn: () => Promise<R>, ok?: string): Promise<R | undefined> {
    setBusy(key);
    try {
      const r = await fn();
      if (ok) toast.success(ok);
      void qc.invalidateQueries({ queryKey: qk.admin.all });
      return r;
    } finally {
      setBusy(null);
    }
  }
  return { run, busy };
}

/** Same zod schema as the API → field messages by path. */
export function check<T>(
  schema: ZodType<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(body);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const i of r.error.issues) {
    const k = i.path.join('.') || '_';
    if (!errors[k]) errors[k] = i.message;
  }
  return { ok: false, errors };
}

/** API error → field messages (and a toast when it is not about one field). */
export function errorsOf(e: unknown): Record<string, string> {
  const f = fieldErrors(e);
  if (Object.keys(f).length === 0 || (isApiError(e) && e.code !== 'VALIDATION_FAILED' && !e.details?.field))
    toast.error(errorMessage(e));
  return f;
}

export const toastError = (e: unknown): undefined => {
  // our own validation messages are thrown as plain Errors; API errors get the friendly text
  toast.error(!isApiError(e) && e instanceof Error && e.name === 'Error' && e.message ? e.message : errorMessage(e));
  return undefined;
};

/** Label + value used on detail pages. */
export function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-ink-400 text-[11px] font-medium tracking-wider uppercase">{label}</p>
      <div className="text-ink-900 tabular mt-1 truncate text-sm font-semibold">{children ?? DASH}</div>
    </div>
  );
}

/** Shared filter bar look. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="border-line bg-surface shadow-card rounded-card mb-6 flex flex-wrap items-center gap-3 border p-4">
      {children}
    </div>
  );
}

export interface ReasonResult {
  reason: string;
  date: string | null;
}
/**
 * Confirmation that needs a reason (≥ 10 characters, kept in the audit log) and, optionally, a date
 * (hold until / cheque cleared on…). Used by every lifecycle, cancel, reverse and bounce action.
 */
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirm,
  tone = 'warning',
  dateLabel,
  dateRequired,
  noReason,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirm: string;
  tone?: 'warning' | 'danger' | 'brand' | 'success';
  dateLabel?: string;
  dateRequired?: boolean;
  noReason?: boolean;
  onConfirm: (r: ReasonResult) => Promise<unknown>;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const short = !noReason && reason.trim().length < 10;
  async function go() {
    setBusy(true);
    try {
      await onConfirm({ reason: reason.trim(), date });
      setReason('');
      setDate(null);
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && !busy && onClose()}
      tone={tone}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={go}
            loading={busy}
            disabled={short || (dateRequired && !date)}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {children}
        {dateLabel && (
          <Field label={dateLabel} required={dateRequired}>
            <DateField value={date} onChange={setDate} clearable={!dateRequired} />
          </Field>
        )}
        {!noReason && (
          <Field label="Reason" required hint="At least 10 characters — kept in the audit log.">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export { adminApi };

// ---------------------------------------------------------------- shared pickers and list helpers

export const STATE_OPTIONS = INDIAN_STATES.map((s) => ({ value: s.code, label: s.name, hint: s.code }));
export const ALL = '__all';
/** Select value → query value ('__all' = no filter). */
export const opt = (v: string | undefined) => (!v || v === ALL ? undefined : v);
export const withAll = (label: string, options: Array<{ value: string; label: ReactNode; hint?: ReactNode }>) => [
  { value: ALL, label },
  ...options,
];
export const labelize = (s: string) => s.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const enumOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: labelize(v) }));

/** Up to 100 clients for pickers (searchable lists use the Clients page). */
export function useClientOptions() {
  const q = useAList<AdminClient>('/clients', { page: 1, pageSize: 100, sort: 'name' });
  return (q.data?.items ?? []).map((c) => ({ value: c.id, label: c.displayName, hint: c.code }));
}
export function ClientSelect({
  value,
  onChange,
  all,
  invalid,
  className,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  all?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const options = useClientOptions();
  return (
    <Select
      className={className}
      invalid={invalid}
      aria-label="Client"
      value={value ?? (all ? ALL : undefined)}
      onValueChange={(v) => onChange(opt(v))}
      placeholder="Choose a client"
      options={all ? withAll('All clients', options) : options}
    />
  );
}

/** page + search + filters for a server-paged list */
export function useListState<F extends Record<string, string | undefined>>(initial: F, pageSize = 25) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<F>(initial);
  const set = <K extends keyof F>(k: K, v: F[K]) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };
  const search = (v: string) => {
    setQ(v);
    setPage(1);
  };
  const query: Query = { page, pageSize, ...(q.trim() ? { q: q.trim() } : {}) };
  for (const [k, v] of Object.entries(filters)) if (opt(v)) query[k] = v;
  return { page, setPage, q, search, filters, set, query, pageSize };
}

/** Download a file / signed URL through adminApi with an error toast. */
export async function adminDownload(path: string, query?: Query, fallbackName?: string) {
  try {
    await adminApi.download(path, { query, fallbackName });
  } catch (e) {
    toastError(e);
  }
}

/** Money cell, right aligned with tabular figures. */
export function MoneyCell({
  v,
  strong,
  tone,
}: {
  v: string | number | null | undefined;
  strong?: boolean;
  tone?: 'danger' | 'success';
}) {
  return (
    <span
      className={cn(
        'tabular whitespace-nowrap',
        strong && 'text-ink-900 font-semibold',
        tone === 'danger' && 'text-danger-600',
        tone === 'success' && 'text-success-600',
      )}
    >
      {fmtMoney(v)}
    </span>
  );
}

/** Two-line cell: bold name + grey sub text (client / plant / code). */
export function NameCell({ name, sub }: { name: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-ink-900 truncate font-semibold">{name}</p>
      {sub && <p className="text-ink-400 truncate text-xs">{sub}</p>}
    </div>
  );
}
