'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/misc';
import { fmtNum, fmtPct, DASH } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PortfolioRow, StandardKind } from '../engine-types';

type BadgeTone = 'success' | 'danger' | 'warning' | 'neutral';

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------
function LogsheetChip({ status }: { status: PortfolioRow['logsheetStatus'] }) {
  const map: Record<PortfolioRow['logsheetStatus'], { label: string; tone: BadgeTone }> = {
    submitted: { label: 'Submitted', tone: 'success' },
    draft: { label: 'Draft', tone: 'warning' },
    missing: { label: 'Missing', tone: 'danger' },
    not_allowed: { label: '—', tone: 'neutral' },
    suspended: { label: 'Suspended', tone: 'neutral' },
  };
  const { label, tone } = map[status] ?? { label: status, tone: 'neutral' };
  return <Badge tone={tone} size="sm">{label}</Badge>;
}

function ComplianceChip({ status }: { status: 'within' | 'exceeded' | 'no_data' }) {
  if (status === 'within') return <Badge tone="success" size="sm">Within</Badge>;
  if (status === 'exceeded') return <Badge tone="danger" size="sm">Exceeded</Badge>;
  return <span className="text-ink-400 text-xs">—</span>;
}

function RegisterChip({ status }: { status: 'ok' | 'expiring' | 'expired' | 'not_available' }) {
  if (status === 'ok') return <Badge tone="success" size="sm">OK</Badge>;
  if (status === 'expiring') return <Badge tone="warning" size="sm">Expiring</Badge>;
  if (status === 'expired') return <Badge tone="danger" size="sm">Expired</Badge>;
  return <span className="text-ink-400 text-xs">N/A</span>;
}

function cellForKey(row: PortfolioRow, _std: StandardKind) {
  const k = row.key;
  return (
    <div className="space-y-0.5 text-right text-xs">
      <div>{fmtNum(k.inflowAct, 2)}</div>
      <div className="text-ink-400">{k.inflowResultToday ?? ''}</div>
      <div className="mt-1">{k.revenueAct !== null ? fmtNum(k.revenueAct, 2) : DASH}</div>
    </div>
  );
}

function cellForCompliance(row: PortfolioRow) {
  const c = row.compliance;
  return (
    <div className="space-y-1 text-xs">
      <ComplianceChip status={c.outletToday} />
      <div className="text-ink-400">{c.outletEventsMtd} event{c.outletEventsMtd !== 1 ? 's' : ''} MTD</div>
      <RegisterChip status={c.worstRegister} />
    </div>
  );
}

function cellForMaintenance(row: PortfolioRow) {
  const m = row.maintenance;
  return (
    <div className="space-y-0.5 text-xs">
      <div>
        <span className={cn('font-semibold', m.criticalOpen > 0 ? 'text-danger-600' : '')}>
          {m.openBreakdowns}
        </span>
        {m.criticalOpen > 0 && (
          <span className="ml-1 text-danger-500">({m.criticalOpen} critical)</span>
        )}
      </div>
      {m.longestOpenDays !== null && (
        <div className="text-ink-400">Longest: {m.longestOpenDays}d</div>
      )}
      {m.availabilityMtd !== null && (
        <div>{fmtPct(m.availabilityMtd * 100, 1)} avail MTD</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------
const ch = createColumnHelper<PortfolioRow>();

interface PortfolioTableProps {
  rows: PortfolioRow[];
  standard: StandardKind | 'primary';
  exceptionsOnly: boolean;
  isLoading: boolean;
  onRowClick: (plantId: string) => void;
}

export function PortfolioTable({
  rows,
  standard,
  exceptionsOnly,
  isLoading,
  onRowClick,
}: PortfolioTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const std: StandardKind = standard === 'primary' ? 'actual' : standard;

  const visible = useMemo(
    () => (exceptionsOnly ? rows.filter((r) => r.exceptions > 0) : rows),
    [rows, exceptionsOnly],
  );

  const columns = useMemo(
    () => [
      ch.accessor('name', {
        header: 'Plant',
        cell: (info) => {
          const r = info.row.original;
          const isSuspended = r.accountState === 'suspended' || r.accountState === 'terminated';
          return (
            <div>
              <div className={cn('font-medium text-sm', isSuspended && 'text-ink-400')}>{r.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-ink-400 text-xs">{r.type} · {fmtNum(r.capacityMld, 1)} MLD</span>
                {isSuspended && <Badge tone="neutral" size="sm">{r.accountState}</Badge>}
              </div>
            </div>
          );
        },
      }),
      ch.display({
        id: 'logsheet',
        header: 'Logsheet',
        cell: (info) => <LogsheetChip status={info.row.original.logsheetStatus} />,
      }),
      ch.display({
        id: 'key',
        header: () => (
          <div className="text-right">
            <div>Key params</div>
            <div className="text-[10px] font-normal text-ink-400">Inflow / Revenue</div>
          </div>
        ),
        cell: (info) => cellForKey(info.row.original, std),
      }),
      ch.accessor((r) => r.chemicals.belowMin + r.chemicals.aboveMtd, {
        id: 'chemicals',
        header: 'Chemicals',
        cell: (info) => {
          const { aboveMtd, belowMin } = info.row.original.chemicals;
          return (
            <div className="space-y-0.5 text-xs">
              {aboveMtd > 0 && <div className="text-danger-600">{aboveMtd} above MTD</div>}
              {belowMin > 0 && <div className="text-warning-600">{belowMin} below min</div>}
              {aboveMtd === 0 && belowMin === 0 && <span className="text-success-600">OK</span>}
            </div>
          );
        },
      }),
      ch.display({
        id: 'compliance',
        header: 'Compliance',
        cell: (info) => cellForCompliance(info.row.original),
      }),
      ch.display({
        id: 'admin',
        header: 'Admin',
        cell: (info) => {
          const a = info.row.original.administrative;
          return (
            <div className="space-y-0.5 text-xs">
              {a.staffAbsent > 0 && <div className="text-danger-600">{a.staffAbsent} absent</div>}
              {a.safetyDeficit > 0 && <div className="text-warning-600">{a.safetyDeficit} safety deficit</div>}
              {a.cashInHand !== null && <div>₹{fmtNum(a.cashInHand, 0)} cash</div>}
            </div>
          );
        },
      }),
      ch.display({
        id: 'maintenance',
        header: 'Maintenance',
        cell: (info) => cellForMaintenance(info.row.original),
      }),
      ch.accessor('exceptions', {
        header: 'Exc.',
        cell: (info) => {
          const n = info.getValue();
          if (n === 0) return <span className="text-ink-300 text-xs">—</span>;
          return <Badge tone="danger" size="sm">{n}</Badge>;
        },
      }),
    ],
    [std],
  );

  const table = useReactTable({
    data: visible,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-line py-16 text-center">
        <p className="text-ink-500 text-sm">
          {exceptionsOnly ? 'No exceptions for today.' : 'No plants found.'}
        </p>
      </div>
    );
  }

  // Totals row
  const totals = {
    openBreakdowns: visible.reduce((s, r) => s + r.maintenance.openBreakdowns, 0),
    exceptions: visible.reduce((s, r) => s + r.exceptions, 0),
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-line bg-canvas">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-medium text-ink-500 whitespace-nowrap"
                  onClick={header.column.getToggleSortingHandler()}
                  style={{ cursor: header.column.getCanSort() ? 'pointer' : undefined }}
                >
                  <div className="flex items-center gap-1">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanSort() && (
                      <ArrowUpDown className="size-3 text-ink-300" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const isSuspended =
              row.original.accountState === 'suspended' ||
              row.original.accountState === 'terminated';
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-b border-line transition-colors last:border-0',
                  isSuspended ? 'opacity-50' : 'cursor-pointer hover:bg-canvas',
                )}
                onClick={() => !isSuspended && onRowClick(row.original.plantId)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-canvas font-semibold">
            <td className="px-4 py-3 text-xs text-ink-500" colSpan={6}>
              Totals ({visible.length} plants)
            </td>
            <td className="px-4 py-3 text-xs">
              {totals.openBreakdowns} open
            </td>
            <td className="px-4 py-3 text-xs">
              {totals.exceptions > 0 ? (
                <Badge tone="danger" size="sm">{totals.exceptions}</Badge>
              ) : (
                <span className="text-ink-300">—</span>
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
