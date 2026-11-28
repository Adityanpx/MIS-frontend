'use client';

import { CircleCheck, Factory, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ProgressBar } from '@/components/ui/misc';
import { DataTable, type Column } from '@/components/ui/table';
import { Segmented } from '@/components/ui/tabs';
import { DASH, fmtAuto, fmtMillion, fmtMoney0, fmtNum, fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PortfolioRow, PortfolioSummary } from '../engine-types';
import { EXTRA_LOGSHEET, HEALTH_META, canOpenPlant, urgency } from './portfolio-ui';

type HealthFilter = 'all' | 'attention' | 'ok' | 'inactive';
const needsAttention = (r: PortfolioRow) => r.health === 'critical' || r.health === 'warning';

const Muted = ({ children }: { children: ReactNode }) => <span className="text-ink-300 text-xs">{children}</span>;
const Sub = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('text-ink-400 mt-0.5 text-[11px] whitespace-nowrap', className)}>{children}</div>
);

function LogsheetCell({ r }: { r: PortfolioRow }) {
  const s = r.logsheetStatus;
  if (s === 'not_due' || s === 'not_live' || s === 'unavailable') {
    return (
      <Badge tone={s === 'unavailable' ? 'danger' : 'neutral'} size="sm">
        {EXTRA_LOGSHEET[s]}
      </Badge>
    );
  }
  return <StatusBadge status={s} size="sm" />;
}

function KeyCell({ r }: { r: PortfolioRow }) {
  const k = r.key;
  if (!k) return <Muted>{DASH}</Muted>;
  return (
    <div className="min-w-[140px]">
      <div className="text-ink-400 truncate text-[11px]">{k.name}</div>
      <div className="text-ink-900 tabular font-medium whitespace-nowrap">
        <span className={cn(k.today.flag === 'bad' && 'text-danger-600')}>{fmtAuto(k.today.act)}</span>
        <span className="text-ink-400 ml-1 text-xs font-normal">{k.unit} today</span>
      </div>
      <Sub>
        MTD{' '}
        <span className={cn('tabular', k.mtd.flag === 'bad' ? 'text-danger-600' : 'text-ink-600')}>
          {fmtAuto(k.mtd.act)}
        </span>
        {k.mtd.std !== null && <> / {fmtAuto(k.mtd.std)}</>}
      </Sub>
    </div>
  );
}

function RevenueCell({ r }: { r: PortfolioRow }) {
  const v = r.revenue;
  if (!v || v.mtdAct === null) return <Muted>{DASH}</Muted>;
  const pct = v.achievementPct;
  const tone = pct === null ? 'brand' : pct >= 100 ? 'success' : pct >= 90 ? 'warning' : 'danger';
  return (
    <div className="ml-auto w-[112px] text-right">
      <div className="text-ink-900 tabular font-medium">{fmtMillion(v.mtdAct)}</div>
      {pct !== null && (
        <>
          <ProgressBar value={Math.min(pct, 100)} tone={tone} height={4} className="mt-1.5" />
          <Sub
            className={cn(
              tone === 'success' && 'text-success-600',
              tone === 'warning' && 'text-warning-600',
              tone === 'danger' && 'text-danger-600',
            )}
          >
            {fmtPct(pct, 0)} of {fmtMillion(v.mtdStd)}
          </Sub>
        </>
      )}
    </div>
  );
}

function ComplianceCell({ r }: { r: PortfolioRow }) {
  if (!r.hasData) return <Muted>{DASH}</Muted>;
  const c = r.compliance;
  const outlet =
    c.outletToday === 'exceeded' ? (
      <Badge tone="danger" size="sm" dot>
        {c.outletFailingToday} exceeded
      </Badge>
    ) : c.outletToday === 'within' ? (
      <Badge tone="success" size="sm" dot>
        Within limits
      </Badge>
    ) : (
      <Badge tone="neutral" size="sm">
        No lab data
      </Badge>
    );
  const reg =
    c.worstRegister === 'expired'
      ? { label: 'BG/insurance expired', cls: 'text-danger-600' }
      : c.worstRegister === 'expiring'
        ? { label: 'BG/insurance expiring', cls: 'text-warning-600' }
        : c.worstRegister === 'ok'
          ? { label: 'Registers valid', cls: '' }
          : { label: 'No registers', cls: '' };
  return (
    <div>
      {outlet}
      <Sub>
        {c.outletEventsMtd} event{c.outletEventsMtd === 1 ? '' : 's'} MTD · <span className={reg.cls}>{reg.label}</span>
      </Sub>
    </div>
  );
}

function ChemicalsCell({ r }: { r: PortfolioRow }) {
  if (!r.hasData) return <Muted>{DASH}</Muted>;
  const c = r.chemicals;
  if (c.tracked === 0) return <Muted>Not tracked</Muted>;
  if (c.belowMin === 0 && c.aboveStdMtd === 0)
    return (
      <span className="text-success-600 inline-flex items-center gap-1 text-xs font-medium">
        <CircleCheck className="size-3.5" /> OK
      </span>
    );
  return (
    <div className="space-y-0.5 text-xs whitespace-nowrap">
      {c.belowMin > 0 && <div className="text-danger-600 font-medium">{c.belowMin} below min stock</div>}
      {c.aboveStdMtd > 0 && <div className="text-warning-600">{c.aboveStdMtd} above std MTD</div>}
    </div>
  );
}

function AdminCell({ r }: { r: PortfolioRow }) {
  if (!r.hasData) return <Muted>{DASH}</Muted>;
  const a = r.administrative;
  const cashBad =
    a.cashInHand !== null && (a.cashInHand < 0 || (a.cashAlertLimit !== null && a.cashInHand < a.cashAlertLimit));
  return (
    <div className="text-xs whitespace-nowrap">
      <div className={cn('tabular font-medium', cashBad ? 'text-danger-600' : 'text-ink-900')}>
        {a.cashInHand === null ? DASH : fmtMoney0(a.cashInHand)}
        <span className="text-ink-400 ml-1 font-normal">cash</span>
      </div>
      <Sub>
        <span className={cn(a.staffAbsentToday ? 'text-warning-600' : '')}>
          {a.staffAbsentToday === null ? DASH : a.staffAbsentToday} absent
        </span>
        {' · '}
        <span className={cn(a.safetyDeficit > 0 ? 'text-warning-600' : '')}>{a.safetyDeficit} safety short</span>
      </Sub>
    </div>
  );
}

function MaintenanceCell({ r }: { r: PortfolioRow }) {
  const m = r.maintenance;
  if (!m.enabled) return <Muted>Not enabled</Muted>;
  return (
    <div className="text-xs whitespace-nowrap">
      <div className="font-medium">
        <span className={cn('tabular', m.openBreakdowns > 0 ? 'text-ink-900' : 'text-success-600')}>
          {m.openBreakdowns} open
        </span>
        {m.criticalOpen > 0 && <span className="text-danger-600 ml-1">· {m.criticalOpen} critical</span>}
      </div>
      <Sub>
        {m.availabilityMtd !== null ? `${fmtPct(m.availabilityMtd * 100, 1)} available` : 'No equipment'}
        {m.longestOpenDays !== null && m.openBreakdowns > 0 && ` · oldest ${m.longestOpenDays}d`}
      </Sub>
    </div>
  );
}

function IssuesCell({ r }: { r: PortfolioRow }) {
  if (r.issues.critical === 0 && r.issues.warning === 0) {
    return r.health === 'inactive' ? (
      <Muted>{DASH}</Muted>
    ) : (
      <CircleCheck className="text-success-500 ml-auto size-4" aria-label="No issues" />
    );
  }
  return (
    <div className="flex justify-end gap-1">
      {r.issues.critical > 0 && (
        <Badge tone="danger" size="sm">
          {r.issues.critical}
        </Badge>
      )}
      {r.issues.warning > 0 && (
        <Badge tone="warning" size="sm">
          {r.issues.warning}
        </Badge>
      )}
    </div>
  );
}

const columns: Column<PortfolioRow>[] = [
  {
    key: 'name',
    header: 'Plant',
    sortKey: 'name',
    cell: (r) => {
      const h = HEALTH_META[r.health];
      return (
        <div className="flex min-w-[200px] items-center gap-3">
          <span title={h.label} className={cn('size-2.5 shrink-0 rounded-full ring-4', h.dot, h.ring)} />
          <div className="min-w-0">
            <div className={cn('truncate font-medium', canOpenPlant(r) ? 'text-ink-900' : 'text-ink-500')}>
              {r.name}
            </div>
            <div className="text-ink-400 mt-0.5 flex items-center gap-1.5 text-[11px] whitespace-nowrap">
              {r.code} · {r.type} · {fmtNum(r.capacityMld, 1)} MLD
              {r.accountState !== 'active' && <StatusBadge status={r.accountState} size="sm" />}
              {r.setupStatus !== 'live' && <StatusBadge status={r.setupStatus} size="sm" />}
            </div>
          </div>
        </div>
      );
    },
  },
  { key: 'logsheet', header: 'Logsheet', sortKey: 'logsheet', cell: (r) => <LogsheetCell r={r} /> },
  { key: 'key', header: 'Key parameter', cell: (r) => <KeyCell r={r} /> },
  { key: 'revenue', header: 'Revenue MTD', align: 'right', sortKey: 'revenue', cell: (r) => <RevenueCell r={r} /> },
  { key: 'compliance', header: 'Compliance', cell: (r) => <ComplianceCell r={r} /> },
  { key: 'chemicals', header: 'Chemicals', cell: (r) => <ChemicalsCell r={r} />, hideBelow: 'lg' },
  { key: 'admin', header: 'Admin', cell: (r) => <AdminCell r={r} />, hideBelow: 'lg' },
  { key: 'maintenance', header: 'Maintenance', cell: (r) => <MaintenanceCell r={r} />, hideBelow: 'md' },
  { key: 'issues', header: 'Issues', align: 'right', sortKey: 'issues', cell: (r) => <IssuesCell r={r} /> },
];

const LOGSHEET_RANK: Record<PortfolioRow['logsheetStatus'], number> = {
  unavailable: 0,
  missing: 1,
  returned: 2,
  draft: 3,
  submitted: 4,
  corrected: 5,
  checked: 6,
  verified: 7,
  not_due: 8,
  not_live: 9,
};
const SORTERS: Record<string, (a: PortfolioRow, b: PortfolioRow) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  issues: (a, b) => urgency(a) - urgency(b),
  logsheet: (a, b) => LOGSHEET_RANK[a.logsheetStatus] - LOGSHEET_RANK[b.logsheetStatus],
  revenue: (a, b) => (a.revenue?.achievementPct ?? -1) - (b.revenue?.achievementPct ?? -1),
};

/** One row per plant with the five MIS areas side by side; row click opens the plant dashboard on the same date. */
export function PortfolioTable({
  rows,
  summary,
  loading,
  onOpen,
}: {
  rows: PortfolioRow[];
  summary: PortfolioSummary | undefined;
  loading: boolean;
  onOpen: (plantId: string) => void;
}) {
  const [filter, setFilter] = useState<HealthFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('-issues');

  const counts = useMemo(
    () => ({
      attention: rows.filter(needsAttention).length,
      ok: rows.filter((r) => r.health === 'ok').length,
      inactive: rows.filter((r) => r.health === 'inactive').length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (q && !`${r.name} ${r.code} ${r.city ?? ''} ${r.type}`.toLowerCase().includes(q)) return false;
      if (filter === 'attention') return needsAttention(r);
      if (filter === 'ok') return r.health === 'ok';
      if (filter === 'inactive') return r.health === 'inactive';
      return true;
    });
    const desc = sort.startsWith('-');
    const cmp = SORTERS[sort.replace(/^-/, '')] ?? SORTERS.name!;
    return [...list].sort((a, b) => (desc ? cmp(b, a) : cmp(a, b)) || a.name.localeCompare(b.name));
  }, [rows, filter, search, sort]);

  const capacity = rows.reduce((a, r) => a + r.capacityMld, 0);
  const rev = summary?.revenueMtd;

  return (
    <Card>
      <CardHeader
        icon={<Factory />}
        title="Plants"
        subtitle={
          loading ? 'Loading…' : `${visible.length} of ${rows.length} shown · click a plant to open its dashboard`
        }
        action={null}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-64">
          <Input
            leading={<Search />}
            placeholder="Find a plant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10"
          />
        </div>
        <Segmented
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: rows.length },
            { value: 'attention', label: 'Needs attention', count: counts.attention },
            { value: 'ok', label: 'Healthy', count: counts.ok },
            { value: 'inactive', label: 'Not reporting', count: counts.inactive },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        rows={visible}
        rowKey={(r) => r.plantId}
        loading={loading}
        skeletonRows={4}
        sort={sort}
        onSortChange={setSort}
        onRowClick={(r) => canOpenPlant(r) && onOpen(r.plantId)}
        empty={
          <EmptyState
            compact
            icon={<Factory />}
            title={rows.length ? 'No plant matches' : 'No plants yet'}
            description={
              rows.length
                ? 'Change the filter or the search.'
                : 'Plants appear here once the platform team adds them to your account.'
            }
          />
        }
      />

      {!loading && summary && rows.length > 0 && (
        <div className="bg-canvas/70 rounded-inner mt-4 grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-4">
          <Total label="Total capacity" value={`${fmtNum(capacity, 1)} MLD`} hint={`${summary.plants} plants`} />
          <Total
            label="Logsheets"
            value={`${summary.logsheets.submitted} / ${summary.logsheets.expected}`}
            hint={
              summary.logsheets.expected === summary.logsheets.submitted
                ? 'All submitted'
                : `${summary.logsheets.missing} missing · ${summary.logsheets.draft + summary.logsheets.returned} pending`
            }
          />
          <Total
            label="Revenue MTD"
            value={rev ? fmtMillion(rev.act) : DASH}
            hint={rev ? `of ${fmtMillion(rev.std)} standard` : 'No revenue data'}
          />
          <Total
            label="Open breakdowns"
            value={fmtNum(summary.breakdowns.open, 0)}
            hint={summary.breakdowns.critical ? `${summary.breakdowns.critical} critical` : 'None critical'}
            danger={summary.breakdowns.critical > 0}
          />
        </div>
      )}
    </Card>
  );
}

function Total({ label, value, hint, danger }: { label: string; value: string; hint: string; danger?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-ink-400 text-[11px] font-medium tracking-wider uppercase">{label}</div>
      <div className="text-ink-900 tabular mt-0.5 text-[15px] font-semibold">{value}</div>
      <div className={cn('truncate text-xs', danger ? 'text-danger-600' : 'text-ink-500')}>{hint}</div>
    </div>
  );
}
