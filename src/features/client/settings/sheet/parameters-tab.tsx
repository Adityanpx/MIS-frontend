'use client';

import { Calculator, Plus, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/popover';
import { clientApi } from '@/lib/api';
import { usePlant } from '../../plant-context';
import { ParameterDrawer } from '../parameter-drawer';
import { currentOf } from '../parts';
import { useSettings } from '../queries';
import { BLOCK_LABEL, type ParameterDto, type StandardRow } from '../types';
import { EditCell, GroupRow, parseNum, SheetBar, SheetTable, Static, Td, Th, useSheet } from './cells';

const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** which standard cells make sense for a parameter (the API decides what is really accepted) */
function applies(p: ParameterDto, cur: StandardRow | undefined) {
  const range = p.stdType === 'range';
  return {
    std: p.stdType === 'per_day' || p.stdType === 'monthly_allowance' || p.stdType === 'required_qty',
    monthly: p.stdType === 'monthly_allowance',
    min: range || (p.stdType !== 'none' && cur?.min != null),
    max: range || (p.stdType !== 'none' && cur?.max != null),
  };
}

export function ParametersTab() {
  const { plant } = usePlant();
  const sheet = useSheet();
  const q = useSettings('parameters');
  useSettings('constants'); // the drawer's formula helper
  const [drawer, setDrawer] = useState<{ param: ParameterDto | null; n: number } | null>(null);
  const [open, setOpen] = useState(false);
  const openDrawer = (param: ParameterDto | null) => {
    setDrawer((d) => ({ param, n: (d?.n ?? 0) + 1 }));
    setOpen(true);
  };

  const rows = useMemo(() => (q.data ?? []).filter((p) => !p.activeTo), [q.data]);
  const blocks = useMemo(() => [...new Set(rows.map((p) => p.logsheetBlock ?? 8))].sort((a, b) => a - b), [rows]);

  const patchUnit = (p: ParameterDto, unit: string) => {
    if (!unit) throw new Error('A unit is required, for example kWh or mg/L.');
    return clientApi.patch(`/plants/${plant.id}/settings/parameters/${p.id}`, { unit });
  };
  const setStd = (
    p: ParameterDto,
    cur: StandardRow | undefined,
    field: 'std' | 'monthly' | 'min' | 'max',
    raw: string,
  ) => {
    const next = { std: cur?.std ?? null, monthly: cur?.monthly ?? null, min: cur?.min ?? null, max: cur?.max ?? null };
    next[field] = parseNum(raw, { min: 0 });
    if (next.min !== null && next.max !== null && next.min > next.max)
      throw new Error('Minimum cannot be above maximum.');
    return clientApi.post(`/plants/${plant.id}/settings/parameters/${p.id}/standards`, {
      kind: 'actual',
      ...next,
      inheritFromKind: cur?.inheritFromKind ?? null,
      ...sheet.eff,
    });
  };

  if (!q.data) return null;
  const wantsStd = (p: ParameterDto) => ['per_day', 'monthly_allowance', 'range'].includes(p.stdType);

  return (
    <>
      <SheetBar hint="Everything you record every day, its unit and the limit it is checked against. Type in any cell; it saves when you leave it.">
        <Button size="sm" variant="secondary" onClick={() => openDrawer(null)} disabled={!sheet.canEdit}>
          <Plus /> Add parameter
        </Button>
      </SheetBar>
      <SheetTable
        head={
          <>
            <Th className="w-[300px]">Parameter</Th>
            <Th className="w-[80px]">Unit</Th>
            <Th className="w-[100px] text-right">Daily</Th>
            <Th className="w-[90px] text-right">Monthly</Th>
            <Th className="w-[80px] text-right">Min</Th>
            <Th className="w-[80px] text-right">Max</Th>
            <Th className="w-[36px]" />
          </>
        }
      >
        {blocks.map((b) => (
          <ParamGroup key={b} cols={7} title={`${b} · ${BLOCK_LABEL[b] ?? `Block ${b}`}`}>
            {rows
              .filter((p) => (p.logsheetBlock ?? 8) === b)
              .sort((a, x) => (a.logsheetOrder ?? 99) - (x.logsheetOrder ?? 99))
              .map((p) => {
                const cur = currentOf(p.standards.actual);
                const a = applies(p, cur);
                const noStd = wantsStd(p) && p.standards.actual.length === 0 && p.standards.bidding.length === 0;
                const lab = p.groupKey === 'lab_inlet' || p.groupKey === 'lab_outlet';
                const noLimit = lab && !cur?.min && !cur?.max && cur?.min !== 0 && cur?.max !== 0;
                const cell = (field: 'std' | 'monthly' | 'min' | 'max', required?: boolean) =>
                  a[field] ? (
                    <EditCell
                      kind="number"
                      value={str(cur?.[field])}
                      required={required}
                      onCommit={(v) => setStd(p, cur, field, v)}
                    />
                  ) : (
                    <Static className="text-ink-300 justify-end">—</Static>
                  );
                return (
                  <tr key={p.id} className="hover:bg-canvas/40">
                    <Td>
                      <div className="flex min-h-8 items-center gap-2 px-2">
                        <span className="text-ink-900 min-w-0 truncate font-medium">{p.name}</span>
                        {p.inputMode !== 'typed' && (
                          <Tooltip
                            content={p.formula ? <span className="font-mono">{p.formula}</span> : 'Worked out for you'}
                          >
                            <span className="text-brand-500 shrink-0 [&_svg]:size-3.5">
                              {p.inputMode === 'calculated' ? <Calculator /> : <Sparkles />}
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <EditCell value={p.unit} required onCommit={(v) => patchUnit(p, v)} />
                    </Td>
                    <Td>{cell('std', noStd && a.std)}</Td>
                    <Td>{cell('monthly')}</Td>
                    <Td>{cell('min', (noStd || noLimit) && !a.std)}</Td>
                    <Td>{cell('max', (noStd || noLimit) && !a.std)}</Td>
                    <Td>
                      <Tooltip content="More settings">
                        <button
                          type="button"
                          onClick={() => openDrawer(p)}
                          aria-label={`More settings for ${p.name}`}
                          className="text-ink-400 hover:bg-canvas hover:text-ink-900 grid size-8 place-items-center rounded-md transition-colors"
                        >
                          <SlidersHorizontal className="size-4" />
                        </button>
                      </Tooltip>
                    </Td>
                  </tr>
                );
              })}
          </ParamGroup>
        ))}
      </SheetTable>
      {drawer && (
        <ParameterDrawer
          key={drawer.param ? `${drawer.param.id}-${drawer.n}` : `new-${drawer.n}`}
          open={open}
          onOpenChange={setOpen}
          param={drawer.param ? (q.data.find((p) => p.id === drawer.param!.id) ?? drawer.param) : null}
        />
      )}
    </>
  );
}

function ParamGroup({ cols, title, children }: { cols: number; title: string; children: React.ReactNode }) {
  return (
    <>
      <GroupRow cols={cols}>{title}</GroupRow>
      {children}
    </>
  );
}
