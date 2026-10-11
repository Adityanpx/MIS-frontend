'use client';

import { Calculator, LayoutGrid, Link2, Plus, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { EmptyState, Switch } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/table';
import { todayIST } from '@/lib/dates';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { blockIcon } from '../logsheet/blocks';
import { ParameterDrawer } from './parameter-drawer';
import { currentOf, SectionHeader, SectionSkeleton, standardText } from './parts';
import { useSettings } from './queries';
import { BLOCK_LABEL, GROUP_LABEL, type ParameterDto, type ParamGroup } from './types';

const MODE = {
  typed: { label: 'Typed', tone: 'neutral' as const, icon: null },
  calculated: { label: 'Calculated', tone: 'brand' as const, icon: <Calculator /> },
  suggested: { label: 'Suggested', tone: 'purple' as const, icon: <Sparkles /> },
};

/** §11.2 Parameter catalogue, grouped by logsheet block. */
export function ParametersSection() {
  const q = useSettings('parameters');
  useSettings('constants'); // formula helper in the drawer
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<'all' | ParamGroup>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [sel, setSel] = useState<{ param: ParameterDto | null; n: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = (param: ParameterDto | null) => {
    setSel((old) => ({ param, n: (old?.n ?? 0) + 1 }));
    setDrawerOpen(true);
  };
  const today = todayIST();

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter(
      (p) =>
        (showInactive || !p.activeTo || p.activeTo >= today) &&
        (group === 'all' || p.groupKey === group) &&
        (!s || p.code.toLowerCase().includes(s) || p.name.toLowerCase().includes(s)),
    );
  }, [q.data, search, group, showInactive, today]);
  const blocks = useMemo(() => [...new Set(rows.map((p) => p.logsheetBlock ?? 8))].sort((a, b) => a - b), [rows]);

  if (!q.data) return <SectionSkeleton rows={4} />;
  const all = q.data.filter((p) => !p.activeTo);
  const counts = {
    total: all.length,
    calc: all.filter((p) => p.inputMode !== 'typed').length,
    cards: all.filter((p) => p.dashboardCard).length,
  };

  const columns: Column<ParameterDto>[] = [
    {
      key: 'name',
      header: 'Parameter',
      cell: (p) => (
        <div className="min-w-0">
          <p className={cn('truncate font-semibold', p.activeTo ? 'text-ink-400' : 'text-ink-900')}>{p.name}</p>
          <p className="text-ink-400 font-mono text-[11px]">{p.code}</p>
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      width: '90px',
      cell: (p) => <span className="text-ink-700">{p.unit}</span>,
      hideBelow: 'sm',
    },
    {
      key: 'mode',
      header: 'Input',
      width: '130px',
      cell: (p) => {
        const m = MODE[p.inputMode];
        const b = (
          <Badge tone={m.tone} size="sm">
            {m.icon}
            {m.label}
          </Badge>
        );
        return p.formula ? <Tooltip content={<span className="font-mono">{p.formula}</span>}>{b}</Tooltip> : b;
      },
    },
    {
      key: 'agg',
      header: 'Totals',
      width: '100px',
      hideBelow: 'lg',
      cell: (p) => <span className="text-ink-500 capitalize">{p.aggregation}</span>,
    },
    {
      key: 'std',
      header: 'Standard today',
      width: '210px',
      hideBelow: 'md',
      cell: (p) => <span className="tabular text-ink-700">{standardText(p, currentOf(p.standards))}</span>,
    },
    {
      key: 'flags',
      header: '',
      width: '96px',
      align: 'right',
      cell: (p) => (
        <span className="text-ink-400 inline-flex items-center gap-2 [&_svg]:size-4">
          {p.linkRole && (
            <Tooltip content="Linked to a stock / staff / safety / cash item">
              <Link2 />
            </Tooltip>
          )}
          {p.dashboardCard && (
            <Tooltip content="Has a dashboard card">
              <LayoutGrid className="text-brand-500" />
            </Tooltip>
          )}
          {p.activeTo ? (
            <Badge size="sm">until {fmtDate(p.activeTo)}</Badge>
          ) : p.mandatory && p.aggregation !== 'text' ? (
            <Tooltip content="Mandatory on the logsheet">
              <span className="text-danger-500 text-base font-bold">*</span>
            </Tooltip>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Parameters"
        description="Everything recorded on the daily logsheet, with its unit, limits, standard and where it shows up. Standards are effective-dated, so history is never rewritten by accident."
        actions={
          <Button onClick={() => openDrawer(null)}>
            <Plus /> Add parameter
          </Button>
        }
      />
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Active parameters', value: counts.total },
          { label: 'Calculated / suggested', value: counts.calc },
          { label: 'Dashboard cards', value: counts.cards },
        ].map((s) => (
          <div key={s.label} className="border-line bg-surface flex items-baseline gap-2 rounded-full border px-4 py-2">
            <span className="text-ink-900 tabular text-base font-bold">{s.value}</span>
            <span className="text-ink-500 text-xs">{s.label}</span>
          </div>
        ))}
      </div>
      <Card padded={false} className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or name…" />
        </div>
        <Select
          className="w-[190px]"
          value={group}
          onValueChange={(v) => setGroup(v as typeof group)}
          options={[
            { value: 'all', label: 'All groups' },
            ...Object.entries(GROUP_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
        <label className="text-ink-700 flex items-center gap-2 text-sm">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} aria-label="Show inactive" /> Show inactive
        </label>
      </Card>
      {rows.length === 0 ? (
        <Card>
          <EmptyState title="No parameters match" description="Change the search or the group filter." />
        </Card>
      ) : (
        blocks.map((b) => {
          const Icon = blockIcon(b);
          const list = rows.filter((p) => (p.logsheetBlock ?? 8) === b);
          return (
            <Card key={b}>
              <div className="mb-3 flex items-center gap-3">
                <span className="bg-brand-50 text-brand-500 grid size-9 place-items-center rounded-xl [&_svg]:size-[18px]">
                  <Icon />
                </span>
                <h3 className="text-ink-900 flex-1 text-base font-semibold">
                  {b} · {BLOCK_LABEL[b] ?? `Block ${b}`}
                </h3>
                <span className="text-ink-400 text-xs">{list.length}</span>
              </div>
              <DataTable
                dense
                columns={columns}
                rows={list.sort((a, x) => (a.logsheetOrder ?? 99) - (x.logsheetOrder ?? 99))}
                rowKey={(p) => p.id}
                onRowClick={(p) => openDrawer(p)}
              />
            </Card>
          );
        })
      )}
      {sel && (
        <ParameterDrawer
          key={sel.param ? `${sel.param.id}-${sel.n}` : `new-${sel.n}`}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          param={sel.param ? (q.data.find((p) => p.id === sel.param!.id) ?? sel.param) : null}
        />
      )}
    </div>
  );
}
