'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable, Pagination } from '@/components/ui/table';
import { addDays, todayIST, type DateRange } from '@/lib/dates';
import { fmtDateTime } from '@/lib/format';
import { ALL, adminDownload, ClientSelect, Fact, FilterBar, labelize, NameCell, opt, useAList } from './kit';
import type { AdminAuditRow } from './types';

const fmtVal = (v: unknown) =>
  v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

/** /admin/audit — every change on the platform, with before → after (SA-AUD-01/02). */
export function AdminAuditView() {
  const [page, setPage] = useState(1);
  const [clientId, setClientId] = useState<string | undefined>();
  const [actorType, setActorType] = useState(ALL);
  const [action, setAction] = useState('');
  const [range, setRange] = useState<DateRange>({ from: addDays(todayIST(), -30), to: todayIST() });
  const [open, setOpen] = useState<AdminAuditRow | null>(null);
  const filters = {
    clientId,
    actorType: opt(actorType),
    action: action.trim() || undefined,
    from: range.from,
    to: range.to,
  };
  const q = useAList<AdminAuditRow>('/audit', { ...filters, page, pageSize: 50 });
  const reset = () => setPage(1);
  const keys = open ? [...new Set([...Object.keys(open.before ?? {}), ...Object.keys(open.after ?? {})])] : [];

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Who changed what, when — for clients, Super Admins and the system"
        actions={
          <Button variant="secondary" onClick={() => void adminDownload('/audit/export', filters, 'audit-log.xlsx')}>
            <Download /> Excel
          </Button>
        }
      />
      <FilterBar>
        <ClientSelect
          all
          className="w-60"
          value={clientId}
          onChange={(v) => {
            setClientId(v);
            reset();
          }}
        />
        <Select
          className="w-44"
          size="sm"
          aria-label="Actor"
          value={actorType}
          onValueChange={(v) => {
            setActorType(v);
            reset();
          }}
          options={[
            { value: ALL, label: 'Everyone' },
            { value: 'super_admin', label: 'Super Admins' },
            { value: 'user', label: 'Client users' },
            { value: 'system', label: 'System' },
          ]}
        />
        <Input
          className="w-48"
          placeholder="Action starts with…"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            reset();
          }}
        />
        <DateRangePicker
          value={range}
          onChange={(r) => {
            setRange(r);
            reset();
          }}
          max={todayIST()}
        />
      </FilterBar>
      <Card>
        <DataTable
          dense
          loading={q.isLoading}
          rows={q.data?.items}
          rowKey={(r) => r.id}
          onRowClick={setOpen}
          empty="Nothing in this period."
          columns={[
            {
              key: 'at',
              header: 'When',
              cell: (r) => <span className="text-xs whitespace-nowrap">{fmtDateTime(r.at)}</span>,
            },
            {
              key: 'c',
              header: 'Client',
              hideBelow: 'md',
              cell: (r) => r.clientName ?? <span className="text-ink-400">Platform</span>,
            },
            {
              key: 'who',
              header: 'Who',
              cell: (r) => (
                <div className="flex items-center gap-1.5">
                  <NameCell name={r.actorName ?? labelize(r.actorType)} sub={labelize(r.actorType)} />
                  {r.actingAsAdminName && (
                    <Badge size="sm" tone="purple">
                      via {r.actingAsAdminName}
                    </Badge>
                  )}
                </div>
              ),
            },
            { key: 'a', header: 'Action', cell: (r) => <span className="text-ink-900 font-medium">{r.action}</span> },
            {
              key: 'e',
              header: 'Entity',
              hideBelow: 'lg',
              cell: (r) => <span className="text-ink-500 text-xs">{labelize(r.entity)}</span>,
            },
          ]}
        />
        {q.data && <Pagination page={page} pageSize={50} total={q.data.meta.total} onPageChange={setPage} />}
      </Card>
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.action ?? ''}
        description={open && fmtDateTime(open.at)}
        width="lg"
      >
        {open && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Fact label="Client">{open.clientName ?? 'Platform'}</Fact>
              <Fact label="By">{open.actorName ?? labelize(open.actorType)}</Fact>
              <Fact label="Entity">{labelize(open.entity)}</Fact>
              <Fact label="Entity ID">{open.entityId}</Fact>
              {open.reason && (
                <Fact label="Reason" className="col-span-2">
                  <span className="whitespace-normal">{open.reason}</span>
                </Fact>
              )}
            </div>
            {keys.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-400 text-left uppercase">
                    <th className="py-2">Field</th>
                    <th className="py-2">Before</th>
                    <th className="py-2">After</th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y divide-dashed">
                  {keys.map((k) => (
                    <tr key={k} className="align-top">
                      <td className="text-ink-700 py-2 pr-3 font-medium">{k}</td>
                      <td className="text-danger-600 py-2 pr-3 break-all">{fmtVal(open.before?.[k])}</td>
                      <td className="text-success-600 py-2 break-all">{fmtVal(open.after?.[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
