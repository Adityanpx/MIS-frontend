'use client';

import { TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { clientApi } from '@/lib/api';
import { fmtDate, fmtMoney } from '@/lib/format';
import { usePlant } from '../../plant-context';
import { apiErrors, useSettings } from '../queries';
import { EditCell, parseNum, SheetBar, SheetTable, Static, Td, Th, useSheet } from './cells';

export function ContractTab() {
  const { plant } = usePlant();
  const sheet = useSheet();
  const q = useSettings('contract-years');
  const [pct, setPct] = useState('');
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = `/plants/${plant.id}/settings/contract-years`;

  if (!q.data) return null;
  const years = q.data.years;
  const first = years[0];
  const pctNum = (() => {
    try {
      return parseNum(pct);
    } catch {
      return null;
    }
  })();
  const canEscalate = sheet.canEdit && !!first?.feeConfigured && years.length > 1 && pctNum !== null;

  async function escalate() {
    setBusy(true);
    try {
      await sheet.run(() =>
        clientApi.post(`${base}/apply-escalation`, {
          fromYearNo: 2,
          pct: pctNum,
          target: 'fixed_fee',
          roundUpToRupee: false,
        }),
      );
      setAsk(false);
    } catch (e) {
      apiErrors(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SheetBar hint="The fixed yearly fee from your contract. Enter year 1, then either type each year or let one yearly increase fill the rest.">
        <div className="flex items-center gap-2">
          <span className="text-ink-500 text-sm">Yearly increase</span>
          <input
            inputMode="decimal"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="%"
            aria-label="Yearly increase in percent"
            className="border-line bg-surface focus:border-brand-500 focus:ring-brand-500/20 h-9 w-20 rounded-md border px-2 text-right text-sm focus:ring-2 focus:outline-none"
          />
          <Button size="sm" variant="secondary" disabled={!canEscalate} onClick={() => setAsk(true)}>
            <TrendingUp /> Fill years 2 to {years.length}
          </Button>
        </div>
      </SheetBar>
      <SheetTable
        head={
          <>
            <Th className="w-[70px]">Year</Th>
            <Th className="w-[110px]">From</Th>
            <Th className="w-[110px]">To</Th>
            <Th className="w-[60px] text-right">Days</Th>
            <Th className="w-[160px] text-right">Fixed fee (₹)</Th>
          </>
        }
      >
        {years.map((y) => (
          <tr key={y.yearNo} className="hover:bg-canvas/40">
            <Td>
              <Static className="text-ink-900 font-medium">Year {y.yearNo}</Static>
            </Td>
            <Td>
              <Static>{fmtDate(y.startDate)}</Static>
            </Td>
            <Td>
              <Static>{fmtDate(y.endDate)}</Static>
            </Td>
            <Td>
              <Static className="justify-end">{y.days}</Static>
            </Td>
            <Td>
              <EditCell
                kind="number"
                value={y.feeConfigured ? String(Number(y.fixedFee)) : ''}
                required={!y.feeConfigured}
                placeholder={y.feeConfigured ? undefined : 'Enter the fee'}
                onCommit={(v) => {
                  const n = parseNum(v, { min: 0 });
                  if (n === null) throw new Error('Enter the yearly fee.');
                  return clientApi.patch(`${base}/${y.yearNo}`, { fixedFee: n.toFixed(2) });
                }}
              />
            </Td>
          </tr>
        ))}
      </SheetTable>
      <p className="text-ink-400 mt-3 text-xs">
        Total contract value {fmtMoney(q.data.totalContractValue)}. Revenue components per year are set later in Plant
        settings.
      </p>
      <Modal
        open={ask}
        onOpenChange={(o) => !busy && setAsk(o)}
        icon={<TrendingUp />}
        title={`Fill years 2 to ${years.length}?`}
        description={`Each year's fee becomes the previous year's fee increased by ${pct}%. This replaces any fees you typed for those years.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={escalate} loading={busy}>
              Fill the years
            </Button>
          </>
        }
      />
    </>
  );
}
