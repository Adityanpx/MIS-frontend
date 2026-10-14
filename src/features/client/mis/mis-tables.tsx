'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { fmtDate, fmtDateTime, fmtNum, fmtPct, fmtMoney0 } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
  BreakdownSummary,
  ChemicalRow,
  Flag,
  LabRow,
  MaintenanceTabPayload,
  MisReport,
  ParamRow,
  RegisterRow,
  ResultMode,
  StandardKind,
  StandardsShown,
  Triple,
} from '../engine-types';
import { flagBg, flagText, formatResult, perKindOf, visibleKinds } from '../engine-ui';

/* ------------------------------------------------------------------ table primitives (MIS look) */
const th =
  'h-9 whitespace-nowrap border-b border-line bg-surface px-3 text-[11px] font-medium uppercase tracking-wider text-ink-400';
const td = 'h-11 whitespace-nowrap border-b border-dashed border-line px-3 text-[13px] tabular';
/** First column stays visible while the wide table scrolls sideways. */
const stickyCol = 'sticky left-0 z-[1] bg-surface';

export function MisTableShell({ children, minWidth = 1100 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="scrollbar-thin -mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
      <table className="w-full border-separate border-spacing-0" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

const signed = (v: number | null, decimals: number) => (v === null ? '—' : `${v > 0 ? '+' : ''}${fmtNum(v, decimals)}`);

function TripleCells({ t, decimals, avg }: { t: Triple; decimals: number; avg?: number | null }) {
  return (
    <>
      <td className={cn(td, 'text-ink-500 text-right')}>{fmtNum(t.std, decimals)}</td>
      <td className={cn(td, 'text-ink-900 text-right font-semibold')}>{fmtNum(t.act, decimals)}</td>
      <td className={cn(td, 'text-right font-medium', flagText[t.varFlag])}>{signed(t.var, decimals)}</td>
      {avg !== undefined && <td className={cn(td, 'text-ink-500 text-right')}>{fmtNum(avg, decimals)}</td>}
    </>
  );
}

function ResultChip({ pct, text, flag }: { pct: number | null; text: string | null; flag: Flag }) {
  if (pct === null && !text) return <span className="text-ink-400">—</span>;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold', flagBg[flag])}
    >
      {pct !== null && <span className="tabular">{fmtPct(Math.abs(pct) * 100, 1)}</span>}
      {text}
    </span>
  );
}

function Events({ n, bad }: { n: number; bad: boolean }) {
  return <span className={cn('font-medium', bad && n > 0 ? 'text-danger-600' : 'text-ink-500')}>{fmtNum(n)}</span>;
}

function GroupHead({ extra }: { extra?: string[] }) {
  return (
    <thead className="sticky top-0 z-[2]">
      <tr>
        <th className={cn(th, stickyCol, 'text-left')} rowSpan={2}>
          Parameter
        </th>
        <th className={cn(th, 'text-left')} rowSpan={2}>
          Unit
        </th>
        <th className={cn(th, 'border-l-line bg-canvas text-ink-700 border-l text-center')} colSpan={3}>
          Today
        </th>
        <th className={cn(th, 'border-l-line bg-brand-50 text-brand-600 border-l text-center')} colSpan={4}>
          Month to date
        </th>
        <th className={cn(th, 'border-l-line bg-canvas text-ink-700 border-l text-center')} colSpan={4}>
          Up to date
        </th>
        <th className={cn(th, 'border-l-line border-l text-center')} colSpan={2}>
          Events
        </th>
        <th className={cn(th, 'border-l-line border-l text-left')} rowSpan={2}>
          UTD result
        </th>
        {extra?.map((e) => (
          <th key={e} className={cn(th, 'border-l-line border-l text-right')} rowSpan={2}>
            {e}
          </th>
        ))}
      </tr>
      <tr>
        {['STD', 'ACT', 'VAR', 'STD', 'ACT', 'VAR', 'Avg/day', 'STD', 'ACT', 'VAR', 'Avg/day', 'MTD', 'UTD'].map(
          (h, i) => (
            <th key={i} className={cn(th, 'text-right', [0, 3, 7, 11].includes(i) && 'border-l-line border-l')}>
              {h}
            </th>
          ),
        )}
      </tr>
    </thead>
  );
}

/* ------------------------------------------------------------------ key parameters & chemicals */
export function ParamTable({ rows, chemicals }: { rows: ParamRow[] | ChemicalRow[]; chemicals?: boolean }) {
  return (
    <MisTableShell minWidth={chemicals ? 1320 : 1180}>
      <GroupHead extra={chemicals ? ['Received', 'Balance'] : undefined} />
      <tbody>
        {rows.map((r, i) => {
          const c = r as ChemicalRow;
          return (
            <motion.tr
              key={r.code}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i, 15) * 0.025 }}
              className="group"
            >
              <td className={cn(td, stickyCol, 'text-ink-900 group-hover:bg-canvas font-medium')}>{r.name}</td>
              <td className={cn(td, 'text-ink-500')}>{r.unit}</td>
              <TripleCells t={r.today!} decimals={r.decimals} />
              <TripleCells t={r.mtd!} decimals={r.decimals} avg={r.avgPerDay.mtd} />
              <TripleCells t={r.utd!} decimals={r.decimals} avg={r.avgPerDay.utd} />
              <td className={cn(td, 'text-right')}>
                <Events n={r.events!.mtd} bad={r.events!.flag === 'bad'} />
              </td>
              <td className={cn(td, 'text-right')}>
                <Events n={r.events!.utd} bad={r.events!.flag === 'bad'} />
              </td>
              <td className={cn(td)}>
                {r.utdResult && (
                  <ResultChip
                    pct={r.utdResult.pct ?? null}
                    text={r.utdResult.text ?? null}
                    flag={r.utdResult.flag ?? 'neutral'}
                  />
                )}
              </td>
              {chemicals && (
                <>
                  <td className={cn(td, 'text-ink-700 text-right')}>{fmtNum(c.received, r.decimals)}</td>
                  <td
                    className={cn(
                      td,
                      'text-right font-semibold',
                      c.balanceFlag === 'bad' ? 'text-danger-600' : 'text-ink-900',
                    )}
                  >
                    {fmtNum(c.balance, r.decimals)}
                  </td>
                </>
              )}
            </motion.tr>
          );
        })}
      </tbody>
    </MisTableShell>
  );
}

/* ------------------------------------------------------------------ lab */
function LabResultChip({
  result,
  flag,
}: {
  result: 'WITHIN LIMIT' | 'EXCEEDED LIMIT' | null;
  flag: Flag;
}) {
  if (!result) return <span className="text-ink-400">—</span>;
  return (
    <span
      className={cn(
        'rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap',
        flag === 'bad' ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600',
      )}
    >
      {result === 'EXCEEDED LIMIT' ? 'Exceeded' : 'Within'}
    </span>
  );
}

/**
 * v11=true: show Today/MTD/UTD result columns (STD-06).
 * v11=false (legacy): show single Result column.
 */
export function LabTable({ rows, v11 = false }: { rows: LabRow[]; v11?: boolean }) {
  const limit = (r: LabRow) =>
    [r.min !== null ? `≥ ${fmtNum(r.min, r.decimals)}` : null, r.max !== null ? `≤ ${fmtNum(r.max, r.decimals)}` : null]
      .filter(Boolean)
      .join(' · ') || '—';

  if (v11) {
    return (
      <MisTableShell minWidth={1060}>
        <thead>
          <tr>
            {[
              { h: 'Parameter', left: true },
              { h: 'Unit', left: true },
              { h: 'Limit', left: true },
              { h: 'Today (act)', left: false },
              { h: 'Result Today', left: true },
              { h: 'Avg MTD', left: false },
              { h: 'Result MTD', left: true },
              { h: 'Avg UTD', left: false },
              { h: 'Result UTD', left: true },
              { h: 'Events MTD', left: false },
              { h: 'Events UTD', left: false },
            ].map(({ h, left }, i) => (
              <th key={h} className={cn(th, i === 0 && stickyCol, left ? 'text-left' : 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="group">
              <td className={cn(td, stickyCol, 'text-ink-900 group-hover:bg-canvas font-medium')}>{r.name}</td>
              <td className={cn(td, 'text-ink-500')}>{r.unit}</td>
              <td className={cn(td, 'text-ink-700')}>{limit(r)}</td>
              <td className={cn(td, 'text-right font-semibold', (r.resultTodayFlag ?? r.resultFlag) === 'bad' ? 'text-danger-600' : 'text-ink-900')}>
                {fmtNum(r.act, r.decimals)}
              </td>
              <td className={td}><LabResultChip result={r.resultToday ?? r.result ?? null} flag={r.resultTodayFlag ?? r.resultFlag ?? 'neutral'} /></td>
              <td className={cn(td, 'text-ink-700 text-right')}>{fmtNum(r.avg.mtd, r.decimals)}</td>
              <td className={td}><LabResultChip result={r.resultMtd ?? null} flag={r.resultMtdFlag ?? 'neutral'} /></td>
              <td className={cn(td, 'text-ink-700 text-right')}>{fmtNum(r.avg.utd, r.decimals)}</td>
              <td className={td}><LabResultChip result={r.resultUtd ?? null} flag={r.resultUtdFlag ?? 'neutral'} /></td>
              <td className={cn(td, 'text-right')}><Events n={r.events.mtd} bad={r.events.flag === 'bad'} /></td>
              <td className={cn(td, 'text-right')}><Events n={r.events.utd} bad={r.events.flag === 'bad'} /></td>
            </tr>
          ))}
        </tbody>
      </MisTableShell>
    );
  }

  return (
    <MisTableShell minWidth={860}>
      <thead>
        <tr>
          {['Parameter', 'Unit', 'Limit', 'Today', 'Result', 'Avg MTD', 'Avg UTD', 'Events MTD', 'Events UTD'].map(
            (h, i) => (
              <th key={h} className={cn(th, i === 0 && stickyCol, i < 3 || i === 4 ? 'text-left' : 'text-right')}>
                {h}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.code} className="group">
            <td className={cn(td, stickyCol, 'text-ink-900 group-hover:bg-canvas font-medium')}>{r.name}</td>
            <td className={cn(td, 'text-ink-500')}>{r.unit}</td>
            <td className={cn(td, 'text-ink-700')}>{limit(r)}</td>
            <td
              className={cn(
                td,
                'text-right font-semibold',
                r.resultFlag === 'bad' ? 'text-danger-600' : 'text-ink-900',
              )}
            >
              {fmtNum(r.act, r.decimals)}
            </td>
            <td className={td}>
              {r.result ? (
                <span
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] font-semibold',
                    r.resultFlag === 'bad' ? 'bg-danger-50 text-danger-600' : 'bg-success-50 text-success-600',
                  )}
                >
                  {r.result === 'EXCEEDED LIMIT' ? 'Exceeded limit' : 'Within limit'}
                </span>
              ) : (
                <span className="text-ink-400">—</span>
              )}
            </td>
            <td className={cn(td, 'text-ink-700 text-right')}>{fmtNum(r.avg.mtd, r.decimals)}</td>
            <td className={cn(td, 'text-ink-700 text-right')}>{fmtNum(r.avg.utd, r.decimals)}</td>
            <td className={cn(td, 'text-right')}>
              <Events n={r.events.mtd} bad={r.events.flag === 'bad'} />
            </td>
            <td className={cn(td, 'text-right')}>
              <Events n={r.events.utd} bad={r.events.flag === 'bad'} />
            </td>
          </tr>
        ))}
      </tbody>
    </MisTableShell>
  );
}

/* ------------------------------------------------------------------ registers */
const REG: Record<RegisterRow['status'], { s: string; l: string }> = {
  VALID: { s: 'active', l: 'Valid' },
  EXPIRING: { s: 'grace', l: 'Expiring' },
  EXPIRED: { s: 'overdue', l: 'Expired' },
  NOT_AVAILABLE: { s: 'draft', l: 'Not available' },
};
export function RegistersTable({ registers }: { registers: MisReport['registers'] }) {
  const rows = [
    ...registers.bankGuarantees.map((r) => ({ ...r, group: 'Bank guarantee' })),
    ...registers.insurance.map((r) => ({ ...r, group: 'Insurance' })),
  ];
  return (
    <MisTableShell minWidth={980}>
      <thead>
        <tr>
          {[
            'Register',
            'Number',
            'Bank / insurer',
            'From',
            'To',
            'Claim up to',
            'Amount / sum assured',
            'Premium',
            'Status',
          ].map((h, i) => (
            <th key={h} className={cn(th, i === 0 && stickyCol, i >= 6 && i <= 7 ? 'text-right' : 'text-left')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.group}-${r.label}`} className="group">
            <td className={cn(td, stickyCol, 'text-ink-900 group-hover:bg-canvas font-medium')}>
              {r.group} · {r.label}
            </td>
            <td className={cn(td, 'text-ink-700')}>{r.number ?? '—'}</td>
            <td className={cn(td, 'text-ink-700')}>{r.party ?? '—'}</td>
            <td className={cn(td, 'text-ink-700')}>{fmtDate(r.start)}</td>
            <td className={cn(td, 'text-ink-700')}>{fmtDate(r.end)}</td>
            <td className={cn(td, 'text-ink-700')}>{fmtDate(r.claimUpTo)}</td>
            <td className={cn(td, 'text-ink-900 text-right')}>{fmtMoney0(r.amount ?? r.sumAssured ?? null)}</td>
            <td className={cn(td, 'text-ink-700 text-right')}>{fmtMoney0(r.premium ?? null)}</td>
            <td className={td}>
              <StatusBadge status={REG[r.status].s} label={REG[r.status].l} size="sm" />
            </td>
          </tr>
        ))}
      </tbody>
    </MisTableShell>
  );
}

/* ------------------------------------------------------------------ staff & safety */
export function StaffTable({ staff }: { staff: MisReport['staff'] }) {
  const cols = ['contract', 'vacant', 'present', 'leave', 'absent'] as const;
  return (
    <MisTableShell minWidth={520}>
      <thead>
        <tr>
          <th className={cn(th, 'text-left')}>Category</th>
          {['On contract', 'Vacant', 'Present', 'Leave', 'Absent'].map((h) => (
            <th key={h} className={cn(th, 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {staff.rows.map((r) => (
          <tr key={r.category}>
            <td className={cn(td, 'text-ink-900 font-medium')}>{r.category}</td>
            {cols.map((k) => (
              <td
                key={k}
                className={cn(
                  td,
                  'text-right',
                  k === 'absent' && r.absentFlag === 'bad' ? 'text-danger-600 font-semibold' : 'text-ink-700',
                )}
              >
                {fmtNum(r[k])}
              </td>
            ))}
          </tr>
        ))}
        <tr>
          <td className={cn(td, 'text-ink-900 border-b-0 font-semibold')}>Total</td>
          {cols.map((k) => (
            <td key={k} className={cn(td, 'text-ink-900 border-b-0 text-right font-semibold')}>
              {fmtNum(staff.total[k] ?? null)}
            </td>
          ))}
        </tr>
      </tbody>
    </MisTableShell>
  );
}

export function SafetyTable({ safety }: { safety: MisReport['safety'] }) {
  return (
    <MisTableShell minWidth={460}>
      <thead>
        <tr>
          <th className={cn(th, 'text-left')}>Safety item</th>
          {['Required', 'Available', 'Deficit'].map((h) => (
            <th key={h} className={cn(th, 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {safety.rows.map((r) => (
          <tr key={r.item}>
            <td className={cn(td, 'text-ink-900 font-medium')}>{r.item}</td>
            <td className={cn(td, 'text-ink-700 text-right')}>{fmtNum(r.required)}</td>
            <td className={cn(td, 'text-ink-700 text-right')}>{fmtNum(r.actual)}</td>
            <td
              className={cn(
                td,
                'text-right',
                r.deficitFlag === 'bad' ? 'text-danger-600 font-semibold' : 'text-ink-700',
              )}
            >
              {fmtNum(r.deficit)}
            </td>
          </tr>
        ))}
        <tr>
          <td className={cn(td, 'text-ink-900 border-b-0 font-semibold')}>Total</td>
          {(['required', 'actual', 'deficit'] as const).map((k) => (
            <td key={k} className={cn(td, 'text-ink-900 border-b-0 text-right font-semibold')}>
              {fmtNum(safety.total[k] ?? null)}
            </td>
          ))}
        </tr>
      </tbody>
    </MisTableShell>
  );
}

/* ------------------------------------------------------------------ v1.1 ParamTable with dual standards + TripleCluster */

function ResultCluster({
  row,
  kind,
  results,
}: {
  row: ParamRow;
  kind: StandardKind;
  results: ResultMode;
}) {
  const k = perKindOf(row, kind);
  const items = [
    { label: 'TODAY', line: k.results.today },
    { label: 'MTD', line: k.results.mtd },
    { label: 'UTD', line: k.results.utd },
  ] as const;
  return (
    <div className="space-y-1">
      {items.map(({ label, line }) => {
        if (line.pct === null && line.qty === null) return null;
        return (
          <div key={label} className={cn('inline-flex items-baseline gap-2 text-[11px]', flagText[line.flag])}>
            <span className="text-ink-400 w-9">{label}</span>
            <span className="font-semibold">{formatResult(line, row.unit, row.decimals, results)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** v1.1 parameter table with optional dual-standard columns and 3-result cluster. */
export function ParamTableV11({
  rows,
  standards,
  results,
  chemicals,
}: {
  rows: ParamRow[];
  standards: StandardsShown;
  results: ResultMode;
  chemicals?: boolean;
}) {
  const kinds = visibleKinds(standards);
  const kindLabel: Record<StandardKind, string> = { bidding: 'B', actual: 'A' };

  return (
    <MisTableShell minWidth={chemicals ? 1400 : 1200}>
      <thead className="sticky top-0 z-[2]">
        <tr>
          <th className={cn(th, stickyCol, 'text-left')} rowSpan={2}>Parameter</th>
          <th className={cn(th, 'text-left')} rowSpan={2}>Unit</th>
          {kinds.map((kind) => (
            <>
              <th
                key={`${kind}-today`}
                className={cn(th, 'border-l-line border-l text-center')}
                colSpan={3}
              >
                Today {kinds.length > 1 ? `(${kindLabel[kind]})` : ''}
              </th>
              <th
                key={`${kind}-mtd`}
                className={cn(th, 'border-l-line bg-brand-50 text-brand-600 border-l text-center')}
                colSpan={4}
              >
                MTD {kinds.length > 1 ? `(${kindLabel[kind]})` : ''}
              </th>
              <th
                key={`${kind}-utd`}
                className={cn(th, 'border-l-line border-l text-center')}
                colSpan={4}
              >
                UTD {kinds.length > 1 ? `(${kindLabel[kind]})` : ''}
              </th>
            </>
          ))}
          <th className={cn(th, 'border-l-line border-l text-center')} colSpan={2}>Events</th>
          <th className={cn(th, 'border-l-line border-l text-left')} rowSpan={2}>Results</th>
          {chemicals && <th className={cn(th, 'border-l-line border-l text-right')} rowSpan={2}>Received</th>}
          {chemicals && <th className={cn(th, 'border-l-line border-l text-right')} rowSpan={2}>Balance</th>}
        </tr>
        <tr>
          {kinds.map((kind) =>
            ['STD', 'ACT', 'VAR', 'STD', 'ACT', 'VAR', 'Avg/d', 'STD', 'ACT', 'VAR', 'Avg/d'].map((h, i) => (
              <th
                key={`${kind}-${i}`}
                className={cn(th, 'text-right', [0, 3, 7].includes(i) && 'border-l-line border-l')}
              >
                {h}
              </th>
            )),
          )}
          <th className={cn(th, 'border-l-line border-l text-right')}>MTD</th>
          <th className={cn(th, 'text-right')}>UTD</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const c = r as ChemicalRow;
          return (
            <motion.tr
              key={r.code}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i, 15) * 0.025 }}
              className="group"
            >
              <td className={cn(td, stickyCol, 'text-ink-900 group-hover:bg-canvas font-medium')}>{r.name}</td>
              <td className={cn(td, 'text-ink-500')}>{r.unit}</td>
              {kinds.map((kind) => {
                const k = perKindOf(r, kind);
                return (
                  <>
                    <TripleCells key={`${kind}-today`} t={k.today} decimals={r.decimals} />
                    <TripleCells key={`${kind}-mtd`} t={k.mtd} decimals={r.decimals} avg={r.avgPerDay.mtd} />
                    <TripleCells key={`${kind}-utd`} t={k.utd} decimals={r.decimals} avg={r.avgPerDay.utd} />
                  </>
                );
              })}
              <td className={cn(td, 'text-right')}>
                <Events n={(perKindOf(r, kinds[0] ?? 'actual').events).mtd} bad={r.events?.flag === 'bad'} />
              </td>
              <td className={cn(td, 'text-right')}>
                <Events n={(perKindOf(r, kinds[0] ?? 'actual').events).utd} bad={r.events?.flag === 'bad'} />
              </td>
              <td className={td}>
                {kinds.map((kind) => (
                  <ResultCluster key={kind} row={r} kind={kind} results={results} />
                ))}
              </td>
              {chemicals && (
                <>
                  <td className={cn(td, 'text-ink-700 text-right')}>{fmtNum(c.received, r.decimals)}</td>
                  <td className={cn(td, 'text-right font-semibold', c.balanceFlag === 'bad' ? 'text-danger-600' : 'text-ink-900')}>
                    {fmtNum(c.balance, r.decimals)}
                  </td>
                </>
              )}
            </motion.tr>
          );
        })}
      </tbody>
    </MisTableShell>
  );
}

/* ------------------------------------------------------------------ maintenance tab (v1.1) */

function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-inner border-line border p-4">
      <p className="text-ink-400 text-xs font-medium">{label}</p>
      <p className="text-ink-900 tabular mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="text-ink-400 mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

function CriticalityChip({ criticality }: { criticality: BreakdownSummary['criticality'] }) {
  const tones: Record<string, string> = {
    critical: 'bg-danger-50 text-danger-600',
    major: 'bg-warning-50 text-warning-700',
    minor: 'bg-muted-bg text-ink-600',
  };
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium capitalize', tones[criticality])}>
      {criticality}
    </span>
  );
}

function BreakdownTable({
  rows,
  title,
  plantId,
}: {
  rows: BreakdownSummary[];
  title: string;
  plantId: string;
}) {
  if (rows.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <h4 className="text-ink-700 mb-2 text-sm font-semibold">{title}</h4>
      <MisTableShell minWidth={900}>
        <thead>
          <tr>
            {['Equipment', 'Criticality', 'Since', 'Age', 'Fault', 'Impact', 'Status', 'Expected restore'].map(
              (h, i) => (
                <th key={h} className={cn(th, i === 0 && stickyCol, 'text-left')}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const startDate = b.startedAt.slice(0, 10);
            const age = Math.max(0, Math.round((new Date(today).getTime() - new Date(startDate).getTime()) / 86_400_000));
            const overdue = b.expectedRestoreOn && b.expectedRestoreOn < today && b.status !== 'restored';
            return (
              <tr key={b.id} className="group">
                <td className={cn(td, stickyCol, 'group-hover:bg-canvas')}>
                  <Link
                    href={`/plants/${plantId}/maintenance/breakdowns/${b.id}`}
                    className="text-brand-500 font-medium hover:underline"
                  >
                    {b.equipmentName}
                  </Link>
                  <span className="text-ink-400 ml-1 text-xs">({b.equipmentCode})</span>
                </td>
                <td className={td}><CriticalityChip criticality={b.criticality} /></td>
                <td className={cn(td, 'text-ink-700')}>{fmtDate(startDate)}</td>
                <td className={cn(td, 'tabular text-ink-700')}>{age}d</td>
                <td className={cn(td, 'text-ink-700 max-w-[200px] truncate')}>{b.fault}</td>
                <td className={cn(td, 'text-ink-700 capitalize')}>{b.impact.replace('_', ' ')}</td>
                <td className={td}>
                  <StatusBadge status={b.status} size="sm" />
                </td>
                <td className={cn(td, overdue ? 'text-danger-600 font-semibold' : 'text-ink-700')}>
                  {fmtDate(b.expectedRestoreOn)}
                  {overdue && ' ⚠'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </MisTableShell>
    </div>
  );
}

export function MaintenanceTabSection({
  data,
  plantId,
}: {
  data: MaintenanceTabPayload;
  plantId: string;
}) {
  const s = data.summary;
  const m = data.metrics;

  const metricRows: Array<{ label: string; key: keyof typeof m.today }> = [
    { label: 'Reported', key: 'reported' },
    { label: 'Restored', key: 'restored' },
    { label: 'Open end of day', key: 'openEndD' },
    { label: 'Critical open', key: 'criticalOpen' },
    { label: 'Downtime (hrs)', key: 'downtimeHrs' },
    { label: 'MTTR (hrs)', key: 'mttrHrs' },
    { label: 'Availability %', key: 'availabilityPct' },
    { label: 'Longest open (days)', key: 'longestOpenDays' },
    { label: 'Repeat breakdowns', key: 'repeatBreakdowns' },
  ];

  const fmtMetric = (v: number | null, key: string) => {
    if (v === null) return '—';
    if (key === 'availabilityPct' || key === 'criticalAvailabilityPct') return fmtPct(v * 100, 1);
    return fmtNum(v, key.includes('Hrs') || key === 'mttrHrs' ? 1 : 0);
  };

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Open now" value={<span className={s.criticalOpen > 0 ? 'text-danger-600' : ''}>{s.openNow}</span>} sub={s.criticalOpen > 0 ? `${s.criticalOpen} critical` : undefined} />
        <StatTile label="Restored today" value={s.restoredToday} />
        <StatTile label="Downtime MTD (hrs)" value={fmtNum(s.downtimeMtd, 1)} />
        <StatTile label="Availability MTD" value={s.availabilityMtd !== null ? fmtPct(s.availabilityMtd * 100, 1) : '—'} />
        <StatTile label="Availability UTD" value={s.availabilityUtd !== null ? fmtPct(s.availabilityUtd * 100, 1) : '—'} />
      </div>

      {/* Metrics table */}
      <Card padded={false}>
        <CardHeader title="Metrics" className="p-5" />
        <MisTableShell minWidth={520}>
          <thead>
            <tr>
              <th className={cn(th, 'text-left')}>Metric</th>
              <th className={cn(th, 'text-right')}>Today</th>
              <th className={cn(th, 'text-right')}>MTD</th>
              <th className={cn(th, 'text-right')}>UTD</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map(({ label, key }) => (
              <tr key={key}>
                <td className={cn(td, 'text-ink-700 font-medium')}>{label}</td>
                <td className={cn(td, 'text-right')}>{fmtMetric(m.today[key] as number | null, key)}</td>
                <td className={cn(td, 'text-right')}>{fmtMetric(m.mtd[key] as number | null, key)}</td>
                <td className={cn(td, 'text-right')}>{fmtMetric(m.utd[key] as number | null, key)}</td>
              </tr>
            ))}
          </tbody>
        </MisTableShell>
      </Card>

      {/* Open breakdowns */}
      {data.openBreakdowns.length > 0 && (
        <BreakdownTable rows={data.openBreakdowns} title="Open breakdowns on this date" plantId={plantId} />
      )}

      {/* Restored today */}
      {data.restoredToday.length > 0 && (
        <BreakdownTable rows={data.restoredToday} title="Restored on this date" plantId={plantId} />
      )}

      {/* Top by downtime */}
      {data.topByDowntime.length > 0 && (
        <div>
          <h4 className="text-ink-700 mb-2 text-sm font-semibold">Top equipment by downtime (UTD)</h4>
          <MisTableShell minWidth={480}>
            <thead>
              <tr>
                {['Equipment', 'Downtime (hrs)', 'Incidents'].map((h) => (
                  <th key={h} className={cn(th, 'text-left')}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.topByDowntime.map((t) => (
                <tr key={t.equipmentId}>
                  <td className={cn(td, 'text-ink-900 font-medium')}>{t.equipmentName}</td>
                  <td className={cn(td, 'text-ink-700')}>{fmtNum(t.downtimeHrs, 1)}</td>
                  <td className={cn(td, 'text-ink-700')}>{t.count}</td>
                </tr>
              ))}
            </tbody>
          </MisTableShell>
        </div>
      )}
    </div>
  );
}
