'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/popover';
import { clientApi } from '@/lib/api';
import { addDays } from '@/lib/dates';
import { fmtDate, fmtNum } from '@/lib/format';
import { usePlant } from '../../plant-context';
import { useSettings } from '../queries';
import { EditCell, parseNum, SheetBar, SheetTable, Static, Td, Th, useSheet } from './cells';
import { NewRow } from './new-row';

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function StockTab() {
  const { plant } = usePlant();
  const sheet = useSheet();
  const q = useSettings('stock-items');
  const [adding, setAdding] = useState(false);
  const base = `/plants/${plant.id}/settings/stock-items`;
  const dayBefore = addDays(plant.misStart, -1);

  if (!q.data) return null;
  const items = q.data.filter((i) => i.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  const patch = (id: string, body: Record<string, unknown>) => clientApi.patch(`${base}/${id}`, body);

  return (
    <>
      <SheetBar
        hint={`The chemicals you keep on site and how much of each you hold today. "As on" is usually the day before the MIS starts (${fmtDate(dayBefore)}).`}
      >
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={!sheet.canEdit || adding}>
          <Plus /> Add chemical
        </Button>
      </SheetBar>
      <SheetTable
        head={
          <>
            <Th className="w-[200px]">Chemical</Th>
            <Th className="w-[70px]">Unit</Th>
            <Th className="w-[90px] text-right">Daily use</Th>
            <Th className="w-[110px] text-right">Opening</Th>
            <Th className="w-[130px]">As on</Th>
            <Th className="w-[90px] text-right">Alert below</Th>
            <Th className="w-[36px]" />
          </>
        }
      >
        {items.map((i) => (
          <tr key={i.id} className="hover:bg-canvas/40">
            <Td>
              <EditCell
                value={i.name}
                required
                onCommit={(v) => {
                  if (!v) throw new Error('A name is required.');
                  return patch(i.id, { name: v });
                }}
              />
            </Td>
            <Td>
              <EditCell
                value={i.unit}
                required
                onCommit={(v) => {
                  if (!v) throw new Error('A unit is required, for example kg.');
                  return patch(i.id, { unit: v });
                }}
              />
            </Td>
            <Td>
              <Tooltip content="Change the daily target in the Parameters tab">
                <Static className="text-ink-500 justify-end">{fmtNum(i.stdPerDay)}</Static>
              </Tooltip>
            </Td>
            <Td>
              <EditCell
                kind="number"
                value={str(i.openingBalance)}
                required
                onCommit={(v) => {
                  const n = parseNum(v, { min: 0 });
                  if (n === null) throw new Error('Enter the stock you hold today (0 if none).');
                  return patch(i.id, { openingBalance: n, ...(i.openingDate ? {} : { openingDate: dayBefore }) });
                }}
              />
            </Td>
            <Td>
              <EditCell
                kind="date"
                value={i.openingDate ?? ''}
                required
                onCommit={(v) => patch(i.id, { openingDate: v })}
              />
            </Td>
            <Td>
              <EditCell
                kind="number"
                value={str(i.minLevel)}
                placeholder="optional"
                onCommit={(v) => patch(i.id, { minLevel: parseNum(v, { min: 0 }) })}
              />
            </Td>
            <Td>
              <Tooltip content="Remove this chemical">
                <button
                  type="button"
                  disabled={!sheet.canEdit}
                  aria-label={`Remove ${i.name}`}
                  onClick={() => void sheet.run(() => patch(i.id, { isActive: false }))}
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
              { key: 'name', placeholder: 'Name, for example Alum' },
              { key: 'unit', placeholder: 'Unit' },
              { key: 'std', placeholder: 'Daily use', kind: 'number' },
              { key: 'open', placeholder: 'Opening stock', kind: 'number', initial: '0' },
              { key: 'date', kind: 'date', initial: dayBefore },
              { key: 'min', placeholder: 'Alert below', kind: 'number' },
              {},
            ]}
            onDone={() => setAdding(false)}
            onAdd={(v) => {
              if (!v.name || !v.unit) throw new Error('Give it a name and a unit.');
              return clientApi.post(base, {
                name: v.name,
                unit: v.unit,
                stdPerDay: parseNum(v.std ?? '', { min: 0 }) ?? 0,
                openingBalance: parseNum(v.open ?? '', { min: 0 }) ?? 0,
                openingDate: v.date || dayBefore,
                minLevel: parseNum(v.min ?? '', { min: 0 }),
              });
            }}
          />
        )}
      </SheetTable>
    </>
  );
}
