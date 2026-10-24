'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Td, useSheet } from './cells';

export interface NewRowCol {
  /** key in the submitted values; omit to leave the column empty */
  key?: string;
  placeholder?: string;
  kind?: 'text' | 'number' | 'date';
  /** a value filled in already (for example a default date) */
  initial?: string;
}

const input =
  'border-line bg-surface focus:border-brand-500 focus:ring-brand-500/20 h-8 w-full min-w-0 rounded-md border px-2 text-sm focus:ring-2 focus:outline-none';

/**
 * The "add a line" row at the bottom of a sheet: one input per column, Add / Cancel in the last one.
 * `onAdd` throws a readable Error to reject the values; the message appears under the row.
 */
export function NewRow({
  cols,
  onAdd,
  onDone,
}: {
  cols: NewRowCol[];
  onAdd: (v: Record<string, string>) => Promise<unknown>;
  onDone: () => void;
}) {
  const sheet = useSheet();
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(cols.filter((c) => c.key).map((c) => [c.key!, c.initial ?? ''])),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const firstKey = cols.find((c) => c.key)?.key;

  async function add() {
    setErr('');
    setBusy(true);
    try {
      await sheet.run(() => onAdd(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim()]))));
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add it.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="bg-brand-50/40">
        {cols.map((c, i) => (
          <Td key={i} className={i === cols.length - 1 ? 'min-w-[200px]' : undefined}>
            <div className="flex items-center gap-1">
              {c.key ? (
                <input
                  autoFocus={c.key === firstKey}
                  type={c.kind === 'date' ? 'date' : 'text'}
                  inputMode={c.kind === 'number' ? 'decimal' : undefined}
                  className={cn(input, c.kind === 'number' && 'text-right')}
                  placeholder={c.placeholder}
                  value={v[c.key] ?? ''}
                  onChange={(e) => setV((s) => ({ ...s, [c.key!]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && void add()}
                />
              ) : (
                <span className="flex-1" />
              )}
              {i === cols.length - 1 && (
                <>
                  <Button size="sm" onClick={add} loading={busy}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onDone} disabled={busy}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </Td>
        ))}
      </tr>
      {err && (
        <tr>
          <td colSpan={cols.length} className="text-danger-600 px-3 py-1.5 text-xs">
            {err}
          </td>
        </tr>
      )}
    </>
  );
}
