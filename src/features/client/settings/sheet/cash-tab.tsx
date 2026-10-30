'use client';

import { clientApi } from '@/lib/api';
import { addDays } from '@/lib/dates';
import { usePlant } from '../../plant-context';
import { useSettings } from '../queries';
import { EditCell, parseNum, SheetBar, SheetTable, Td, Th, useSheet } from './cells';

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

export function CashTab() {
  const { plant } = usePlant();
  const sheet = useSheet();
  const q = useSettings('cash');
  if (!q.data) return null;
  const c = q.data;
  const patch = (body: Record<string, unknown>) => clientApi.patch(`/plants/${plant.id}/settings/cash`, body);

  return (
    <>
      <SheetBar hint="The petty cash held on site on the day before the MIS starts, and the daily spending amount that should raise an alert. Leave the alert empty for no alert." />
      <SheetTable
        head={
          <>
            <Th className="w-[130px] text-right">Opening cash (₹)</Th>
            <Th className="w-[130px]">As on</Th>
            <Th className="w-[160px] text-right">Daily expense alert (₹)</Th>
            <Th className="w-[130px] text-right">Petty float (₹)</Th>
          </>
        }
      >
        <tr>
          <Td>
            <EditCell
              kind="number"
              value={str(c.cashOpening)}
              disabled={sheet.live}
              required
              onCommit={(v) => {
                const n = parseNum(v, { min: 0 });
                if (n === null) throw new Error('Enter the cash you hold today (0 if none).');
                return patch({
                  cashOpening: n,
                  ...(c.cashOpeningDate ? {} : { cashOpeningDate: addDays(plant.misStart, -1) }),
                });
              }}
            />
          </Td>
          <Td>
            <EditCell
              kind="date"
              value={c.cashOpeningDate ?? ''}
              disabled={sheet.live}
              required
              onCommit={(v) => patch({ cashOpeningDate: v })}
            />
          </Td>
          <Td>
            <EditCell
              kind="number"
              value={str(c.cashAlertLimit)}
              placeholder="optional"
              onCommit={(v) => patch({ cashAlertLimit: parseNum(v, { min: 0 }) })}
            />
          </Td>
          <Td>
            <EditCell
              kind="number"
              value={str(c.pettyFloat)}
              placeholder="optional"
              onCommit={(v) => patch({ pettyFloat: parseNum(v, { min: 0 }) })}
            />
          </Td>
        </tr>
      </SheetTable>
    </>
  );
}
