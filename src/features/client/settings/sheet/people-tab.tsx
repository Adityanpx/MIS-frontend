'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/popover';
import { clientApi } from '@/lib/api';
import { usePlant } from '../../plant-context';
import { currentOf } from '../parts';
import { useSettings } from '../queries';
import { EditCell, parseNum, SheetTable, Td, Th, useSheet } from './cells';
import { NewRow } from './new-row';

interface Line {
  id: string;
  name: string;
  /** the count in force today; null = nothing entered yet */
  count: number | null;
}

/** One small sheet: a name and a required number. Staff categories and safety items work the same way. */
function CountSheet({
  title,
  hint,
  noun,
  column,
  lines,
  path,
  sub,
  field,
}: {
  title: string;
  hint: string;
  noun: string;
  column: string;
  lines: Line[];
  path: 'staff' | 'safety';
  /** the sub-resource that takes a dated count */
  sub: 'strengths' | 'requirements';
  field: 'strength' | 'qty';
}) {
  const { plant } = usePlant();
  const sheet = useSheet();
  const [adding, setAdding] = useState(false);
  const base = `/plants/${plant.id}/settings/${path}`;
  const whole = (raw: string) => {
    const n = parseNum(raw, { min: 0 });
    if (n === null) throw new Error('Enter a number (0 if none).');
    if (!Number.isInteger(n)) throw new Error('Use a whole number.');
    return n;
  };

  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-ink-900 text-sm font-semibold">{title}</h3>
          <p className="text-ink-500 mt-0.5 text-xs">{hint}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={!sheet.canEdit || adding}>
          <Plus /> Add
        </Button>
      </div>
      <SheetTable
        className="mx-0"
        head={
          <>
            <Th className="w-[220px]">{noun}</Th>
            <Th className="w-[80px] text-right">{column}</Th>
            <Th className="w-[36px]" />
          </>
        }
      >
        {lines.map((l) => (
          <tr key={l.id} className="hover:bg-canvas/40">
            <Td>
              <EditCell
                value={l.name}
                required
                onCommit={(v) => {
                  if (!v) throw new Error('A name is required.');
                  return clientApi.patch(`${base}/${l.id}`, { name: v });
                }}
              />
            </Td>
            <Td>
              <EditCell
                kind="number"
                value={l.count === null ? '' : String(l.count)}
                required
                onCommit={(v) => clientApi.post(`${base}/${l.id}/${sub}`, { [field]: whole(v), ...sheet.eff })}
              />
            </Td>
            <Td>
              <Tooltip content={`Remove this ${noun.toLowerCase()}`}>
                <button
                  type="button"
                  disabled={!sheet.canEdit}
                  aria-label={`Remove ${l.name}`}
                  onClick={() => void sheet.run(() => clientApi.patch(`${base}/${l.id}`, { isActive: false }))}
                  className="text-ink-300 hover:bg-danger-50 hover:text-danger-600 grid size-8 place-items-center rounded-md transition-colors disabled:opacity-40"
                >
                  <X className="size-4" />
                </button>
              </Tooltip>
            </Td>
          </tr>
        ))}
        {adding && (
          <NewRow
            cols={[
              { key: 'name', placeholder: `${noun} name` },
              { key: 'count', placeholder: column, kind: 'number', initial: '0' },
              {},
            ]}
            onDone={() => setAdding(false)}
            onAdd={(v) => {
              if (!v.name) throw new Error('Give it a name.');
              return clientApi.post(base, {
                name: v.name,
                [field === 'strength' ? 'strength' : 'qty']: whole(v.count ?? ''),
              });
            }}
          />
        )}
      </SheetTable>
    </section>
  );
}

export function PeopleTab() {
  const staff = useSettings('staff');
  const safety = useSettings('safety');
  if (!staff.data || !safety.data) return null;
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <CountSheet
        title="Staff"
        hint="How many people you need on site, by category."
        noun="Category"
        column="Required"
        path="staff"
        sub="strengths"
        field="strength"
        lines={staff.data
          .filter((s) => s.isActive)
          .map((s) => ({ id: s.id, name: s.name, count: currentOf(s.strengths)?.strength ?? null }))}
      />
      <CountSheet
        title="Safety items"
        hint="Safety equipment that must be available, and how many."
        noun="Item"
        column="Required"
        path="safety"
        sub="requirements"
        field="qty"
        lines={safety.data
          .filter((s) => s.isActive)
          .map((s) => ({ id: s.id, name: s.name, count: currentOf(s.requirements)?.qty ?? null }))}
      />
    </div>
  );
}
