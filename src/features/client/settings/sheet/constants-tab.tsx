'use client';

import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/api';
import { usePlant } from '../../plant-context';
import { currentOf } from '../parts';
import { useSettings } from '../queries';
import type { ConstantRow } from '../types';
import { EditCell, parseNum, SheetBar, SheetTable, Static, Td, Th, useSheet } from './cells';
import { NewRow } from './new-row';

/** Name → CODE: "DG set capacity" → DG_SET_CAPACITY (the API wants UPPER_CASE). */
export const toCode = (name: string) => {
  const c = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return /^[A-Z]/.test(c) ? c : `C_${c}`;
};

export function ConstantsTab() {
  const { plant } = usePlant();
  const sheet = useSheet();
  const q = useSettings('constants');
  const [adding, setAdding] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, ConstantRow[]>();
    for (const c of q.data ?? []) m.set(c.code, [...(m.get(c.code) ?? []), c]);
    return [...m.values()].map((rows) => currentOf(rows)!);
  }, [q.data]);

  const save = (c: { code: string; name: string; unit: string | null }, value: number) =>
    clientApi.post(`/plants/${plant.id}/settings/constants`, {
      code: c.code,
      name: c.name,
      value,
      ...(c.unit ? { unit: c.unit } : {}),
      ...sheet.eff,
    });

  if (!q.data) return null;
  return (
    <>
      <SheetBar hint="Fixed numbers the reports use in their calculations, such as plant capacity or the load factor. Change the value; the name stays.">
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={!sheet.canEdit || adding}>
          <Plus /> Add constant
        </Button>
      </SheetBar>
      <SheetTable
        head={
          <>
            <Th className="w-[320px]">Constant</Th>
            <Th className="w-[110px] text-right">Value</Th>
            <Th className="w-[90px]">Unit</Th>
          </>
        }
      >
        {groups.map((c) => (
          <tr key={c.code} className="hover:bg-canvas/40">
            <Td>
              <Static className="text-ink-900 font-medium">{c.name}</Static>
            </Td>
            <Td>
              <EditCell
                kind="number"
                value={String(c.value)}
                required
                onCommit={(v) => {
                  const n = parseNum(v);
                  if (n === null) throw new Error('A value is required.');
                  return save(c, n);
                }}
              />
            </Td>
            <Td>
              <Static className="text-ink-500">{c.unit ?? ''}</Static>
            </Td>
          </tr>
        ))}
        {adding && (
          <NewRow
            cols={[
              { key: 'name', placeholder: 'Name, for example DG set capacity' },
              { key: 'value', placeholder: 'Value', kind: 'number' },
              { key: 'unit', placeholder: 'Unit (optional)' },
            ]}
            onDone={() => setAdding(false)}
            onAdd={(v) => {
              const n = parseNum(v.value ?? '');
              if (!v.name || n === null) throw new Error('Give it a name and a value.');
              const code = toCode(v.name);
              if (groups.some((g) => g.code === code))
                throw new Error('A constant with this name already exists. Edit it above.');
              return save({ code, name: v.name, unit: v.unit || null }, n);
            }}
          />
        )}
      </SheetTable>
    </>
  );
}
