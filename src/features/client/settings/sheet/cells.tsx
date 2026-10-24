'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { errorMessage, isApiError } from '@/lib/api';
import { todayIST } from '@/lib/dates';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { usePlant } from '../../plant-context';

/** What every sheet needs: the effective date of a set-up value, and one place that runs + tracks saves. */
interface SheetCtx {
  /** Set-up values apply from the MIS start, so they replace the template's rows instead of stacking on them. */
  eff: { effectiveFrom: string; reason?: string };
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  canEdit: boolean;
}
const Ctx = createContext<SheetCtx | null>(null);
export const useSheet = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSheet must be used inside <SheetProvider>');
  return v;
};

export function SheetProvider({
  canEdit,
  onBusy,
  children,
}: {
  canEdit: boolean;
  onBusy: (pending: number, failed: boolean) => void;
  children: ReactNode;
}) {
  const { plant } = usePlant();
  const qc = useQueryClient();
  const pending = useRef(0);
  const failed = useRef(false);
  const eff = useMemo<SheetCtx['eff']>(
    () => ({
      effectiveFrom: plant.misStart,
      ...(plant.misStart < todayIST() ? { reason: 'Plant set-up' } : {}),
    }),
    [plant.misStart],
  );

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      pending.current += 1;
      onBusy(pending.current, failed.current);
      try {
        const out = await fn();
        failed.current = false;
        // every settings change can move the go-live checklist, the plant and the reports
        await qc.invalidateQueries({ queryKey: qk.client.plant(plant.id) });
        void qc.invalidateQueries({ queryKey: qk.client.overview });
        return out;
      } catch (e) {
        failed.current = true;
        throw e;
      } finally {
        pending.current -= 1;
        onBusy(pending.current, failed.current);
      }
    },
    [qc, plant.id, onBusy],
  );

  const value = useMemo(() => ({ eff, run, canEdit }), [eff, run, canEdit]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** A readable message for the toast; plain Errors thrown by our own checks keep their text. */
function messageOf(e: unknown) {
  return !isApiError(e) && e instanceof Error ? e.message : errorMessage(e);
}

/** Parse a typed number: '' → null, otherwise a finite number or a thrown, readable error. */
export function parseNum(raw: string, opts: { min?: number } = {}): number | null {
  const t = raw.replace(/[,\s₹]/g, '');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`"${raw}" is not a number.`);
  if (opts.min !== undefined && n < opts.min) throw new Error(`The value cannot be below ${opts.min}.`);
  return n;
}

const field =
  'h-8 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-ink-900 transition-colors placeholder:text-ink-300 hover:border-line focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-default disabled:text-ink-400 disabled:hover:border-transparent';

/**
 * One editable spreadsheet cell. Saves when you leave it (or press Enter, which also moves down),
 * Escape puts the old value back. Red = still required or the last save failed.
 */
export function EditCell({
  value,
  onCommit,
  kind = 'text',
  disabled,
  required,
  placeholder,
  suffix,
}: {
  value: string;
  /** receives the trimmed text; throw to reject it (the message is shown) */
  onCommit: (v: string) => Promise<unknown>;
  kind?: 'text' | 'number' | 'date';
  disabled?: boolean;
  /** the go-live check wants a value here */
  required?: boolean;
  placeholder?: string;
  suffix?: string;
}) {
  const sheet = useSheet();
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function commit(next: string) {
    const v = next.trim();
    if (v === value.trim()) return setState('idle');
    setState('saving');
    try {
      await sheet.run(() => onCommit(v));
      setState('saved');
      timer.current = setTimeout(() => setState('idle'), 1400);
    } catch (e) {
      setState('error');
      toast.error(messageOf(e));
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setDraft(value);
      setState('idle');
      e.currentTarget.blur();
    }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const cell = e.currentTarget.closest('td');
    const col = cell?.cellIndex ?? 0;
    let row = cell?.parentElement?.nextElementSibling ?? null;
    void commit(draft);
    while (row) {
      const input = (row as HTMLTableRowElement).cells[col]?.querySelector<HTMLInputElement>('input:not(:disabled)');
      if (input) {
        input.focus();
        input.select?.();
        break;
      }
      row = row.nextElementSibling;
    }
  }

  const empty = draft.trim() === '';
  return (
    <div className="relative">
      <input
        value={draft}
        type={kind === 'date' ? 'date' : 'text'}
        inputMode={kind === 'number' ? 'decimal' : undefined}
        disabled={disabled || !sheet.canEdit}
        placeholder={placeholder}
        aria-invalid={state === 'error' || (required && empty) || undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          if (state === 'error') setState('idle');
          if (kind === 'date' && e.target.value.length === 10) void commit(e.target.value);
        }}
        onBlur={() => kind !== 'date' && commit(draft)}
        onKeyDown={onKey}
        className={cn(
          field,
          kind === 'number' && 'text-right tabular-nums',
          suffix && 'pr-9',
          (state === 'error' || (required && empty)) && 'border-danger-500/50 bg-danger-50/60',
          state === 'saved' && 'border-success-600/50 bg-success-50/60',
        )}
      />
      {suffix && !empty && (
        <span className="text-ink-400 pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px]">
          {suffix}
        </span>
      )}
      {state === 'saving' && (
        <Loader2 className="text-ink-400 absolute top-1/2 right-2 size-3.5 -translate-y-1/2 animate-spin" />
      )}
      {state === 'saved' && !suffix && (
        <Check className="text-success-600 absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
      )}
    </div>
  );
}

/** Spreadsheet frame: sticky header, grid lines, scrolls inside its own box. */
export function SheetTable({
  head,
  children,
  className,
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-line bg-surface mx-auto w-fit max-w-full overflow-auto rounded-xl border', className)}>
      <table className="w-auto border-collapse text-[13px]">
        <thead className="bg-canvas sticky top-0 z-10">
          <tr className="text-ink-500 text-left text-[11px] font-semibold tracking-wider uppercase">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <th className={cn('border-line border-r border-b px-2.5 py-1.5 font-semibold last:border-r-0', className)}>
    {children}
  </th>
);
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn('border-line border-r border-b p-px last:border-r-0', className)}>{children}</td>
);
/** read-only text cell, aligned with the inputs */
export const Static = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('text-ink-700 flex min-h-8 items-center px-2', className)}>{children}</div>
);
/** a full-width row that names the group below it */
export function GroupRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="bg-canvas/70 border-line text-ink-500 border-b px-2.5 py-1 text-xs font-semibold">
        {children}
      </td>
    </tr>
  );
}

/** the line above a table: a plain-language hint and, on the right, the add button */
export function SheetBar({ hint, children }: { hint: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-ink-500 max-w-2xl text-sm">{hint}</p>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
