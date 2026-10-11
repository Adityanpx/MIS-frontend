'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/ui/table';
import { fmtDate, fmtNum, fmtRelative } from '@/lib/format';
import { ALL, ClientSelect, FilterBar, NameCell, opt, useA } from './kit';
import type { UsageRow } from './types';

const FLAGS = [
  { value: 'noLogsheet3d', label: 'No logsheet for 3 days' },
  { value: 'nearUserLimit', label: 'Near the user limit' },
  { value: 'nearStorageLimit', label: 'Near the storage limit' },
  { value: 'inactiveClient', label: 'No sign-in for 30 days' },
] as const;

/** Users / storage / logsheet activity per plant, with warning flags (SA-USG-01). */
export function UsageTable({
  rows,
  loading,
  showClient = true,
}: {
  rows: UsageRow[] | undefined;
  loading?: boolean;
  showClient?: boolean;
}) {
  const router = useRouter();
  return (
    <DataTable
      loading={loading}
      rows={rows}
      rowKey={(r) => r.plantId}
      onRowClick={(r) => router.push(`/admin/plants/${r.plantId}`)}
      empty="No plants match."
      columns={[
        {
          key: 'p',
          header: 'Plant',
          cell: (r) => <NameCell name={r.plantName} sub={showClient ? r.clientName : undefined} />,
        },
        {
          key: 'u',
          header: 'Users',
          width: '150px',
          cell: (r) => (
            <div>
              <span className="tabular text-xs">
                {fmtNum(r.activeUsers)} / {fmtNum(r.maxUsers)}
              </span>
              <ProgressBar value={r.activeUsers} max={r.maxUsers} tone="auto" height={4} />
            </div>
          ),
        },
        {
          key: 's',
          header: 'Storage',
          width: '150px',
          hideBelow: 'md',
          cell: (r) => (
            <div>
              <span className="tabular text-xs">
                {fmtNum(r.storageBytes / 1073741824, 2)} / {fmtNum(r.storageGb)} GB
              </span>
              <ProgressBar value={r.storageBytes / 1073741824} max={r.storageGb} tone="auto" height={4} />
            </div>
          ),
        },
        {
          key: 'l7',
          header: 'Logsheets 7 d / 30 d',
          align: 'right',
          cell: (r) => (
            <span className="tabular">
              {fmtNum(r.logsheets7d)} / {fmtNum(r.logsheets30d)}
            </span>
          ),
        },
        {
          key: 'last',
          header: 'Last logsheet',
          hideBelow: 'lg',
          cell: (r) => <span className="text-xs">{fmtDate(r.lastLogsheetDate)}</span>,
        },
        {
          key: 'login',
          header: 'Last sign-in',
          hideBelow: 'lg',
          cell: (r) => <span className="text-ink-500 text-xs">{fmtRelative(r.lastLoginAt)}</span>,
        },
        {
          key: 'f',
          header: 'Flags',
          cell: (r) => (
            <div className="flex flex-wrap gap-1">
              <StatusBadge status={r.setupStatus} size="sm" />
              {FLAGS.filter((f) => r.flags[f.value]).map((f) => (
                <Badge key={f.value} size="sm" tone="warning">
                  {f.label}
                </Badge>
              ))}
            </div>
          ),
        },
      ]}
    />
  );
}

/** /admin/usage */
export function UsageView() {
  const sp = useSearchParams();
  const [clientId, setClientId] = useState<string | undefined>();
  const [flag, setFlag] = useState<string>(sp.get('flag') ?? ALL);
  const q = useA<UsageRow[]>('/usage', { clientId, flag: opt(flag) });
  return (
    <>
      <PageHeader title="Usage" subtitle="Who is using OMMIS, and which plants need a nudge" />
      <FilterBar>
        <ClientSelect all value={clientId} onChange={setClientId} className="w-64" />
        <Select
          className="w-60"
          size="sm"
          aria-label="Flag"
          value={flag}
          onValueChange={setFlag}
          options={[{ value: ALL, label: 'All plants' }, ...FLAGS]}
        />
        {q.data && <span className="text-ink-500 ml-auto text-xs">{fmtNum(q.data.length)} plant(s)</span>}
      </FilterBar>
      <Card>
        <UsageTable rows={q.data} loading={q.isLoading} />
      </Card>
    </>
  );
}
