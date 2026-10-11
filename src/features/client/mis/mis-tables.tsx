'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { fmtDate, fmtMoney0, fmtNum, fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ChemicalRow, Flag, LabRow, MisReport, ParamRow, RegisterRow, Triple } from '../engine-types';
import { flagBg, flagText } from '../engine-ui';

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
              <TripleCells t={r.today} decimals={r.decimals} />
              <TripleCells t={r.mtd} decimals={r.decimals} avg={r.avgPerDay.mtd} />
              <TripleCells t={r.utd} decimals={r.decimals} avg={r.avgPerDay.utd} />
              <td className={cn(td, 'text-right')}>
                <Events n={r.events.mtd} bad={r.events.flag === 'bad'} />
              </td>
              <td className={cn(td, 'text-right')}>
                <Events n={r.events.utd} bad={r.events.flag === 'bad'} />
              </td>
              <td className={cn(td)}>
                <ResultChip {...r.utdResult} />
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
export function LabTable({ rows }: { rows: LabRow[] }) {
  const limit = (r: LabRow) =>
    [r.min !== null ? `≥ ${fmtNum(r.min, r.decimals)}` : null, r.max !== null ? `≤ ${fmtNum(r.max, r.decimals)}` : null]
      .filter(Boolean)
      .join(' · ') || '—';
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
