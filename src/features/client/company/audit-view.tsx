'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, History, LifeBuoy } from 'lucide-react';
import { useState } from 'react';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { Collapse } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/table';
import { clientApi } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { addDays, todayIST, type DateRange } from '@/lib/dates';
import { fmtDateTime } from '@/lib/format';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { ClientAdminOnly, type AuditRow } from './company-api';

const PAGE = 25;
/** The audit `entity` values a client sees (backend writeAudit calls). */
const ENTITIES = [
  { value: 'all', label: 'Everything' },
  { value: 'logsheet', label: 'Logsheets' },
  { value: 'correction_request', label: 'Correction requests' },
  { value: 'import', label: 'Excel imports' },
  { value: 'parameter', label: 'Parameters' },
  { value: 'stock_item', label: 'Stock items' },
  { value: 'contract_year', label: 'Contract years' },
  { value: 'plant', label: 'Plants' },
  { value: 'user', label: 'Users' },
  { value: 'client', label: 'Company' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'payment', label: 'Payments' },
  { value: 'payment_notification', label: '“I have paid” notices' },
  { value: 'tds', label: 'TDS' },
  { value: 'export', label: 'Exports' },
];
const show = (v: unknown) =>
  v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

/** Field-by-field before → after of one audit entry. */
function Diff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  if (!keys.length) return <p className="text-ink-500 text-xs">No field details.</p>;
  return (
    <div className="rounded-inner border-line overflow-x-auto border">
      <table className="w-full text-[12px]">
        <tbody className="divide-line divide-y">
          {keys.map((k) => (
            <tr key={k}>
              <td className="text-ink-500 w-48 px-3 py-1.5 font-mono">{k}</td>
              <td className="text-ink-400 max-w-[280px] truncate px-3 py-1.5 line-through">
                {before ? show(before[k]) : ''}
              </td>
              <td className="text-ink-900 max-w-[280px] truncate px-3 py-1.5 font-medium">
                {after ? show(after[k]) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** /company/audit — who changed what (CA-14). */
export function AuditView() {
  const signedIn = useClientAuth().status === 'authenticated';
  const isAdmin = !!useClientAuth().profile?.user.isClientAdmin;
  const [range, setRange] = useState<DateRange>({ from: addDays(todayIST(), -29), to: todayIST() });
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('all');
  const [open, setOpen] = useState<number | string | null>(null);
  const query = {
    from: range.from,
    to: range.to,
    action: action.trim() || undefined,
    entity: entity === 'all' ? undefined : entity,
    page,
    pageSize: PAGE,
  };
  const q = useQuery({
    queryKey: qk.client.audit(query),
    queryFn: () => clientApi.list<AuditRow>('/company/audit', query),
    enabled: signedIn && isAdmin, // Client Admin only (403 otherwise)
    placeholderData: keepPreviousData,
  });
  return (
    <ClientAdminOnly title="Audit log">
      <PageHeader title="Audit log" subtitle="Every change in your company, with who made it and when" />
      <Card padded={false} className="mb-6 flex flex-wrap items-center gap-3 p-4">
        <DateRangePicker
          value={range}
          onChange={(r) => {
            setRange(r);
            setPage(1);
          }}
          max={todayIST()}
        />
        <Select
          className="w-52"
          aria-label="What changed"
          value={entity}
          onValueChange={(v) => {
            setEntity(v);
            setPage(1);
          }}
          options={ENTITIES}
        />
        <div className="w-64">
          <Input
            value={action}
            placeholder="Action, e.g. logsheet.correct"
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </Card>
      <Card>
        {q.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : !q.data?.items.length ? (
          <EmptyState
            icon={<History />}
            title="Nothing in this period"
            description="Change the dates or the filters."
          />
        ) : (
          <ul className={cn('divide-line divide-y', q.isFetching && 'opacity-60')}>
            {q.data.items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setOpen(open === a.id ? null : a.id)}
                  className="hover:bg-canvas flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left"
                >
                  <Avatar name={a.actor.name ?? 'System'} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-ink-900 truncate text-sm">
                      <span className="font-semibold">{a.actor.name ?? 'System'}</span>{' '}
                      <span className="text-ink-500">·</span> <span className="font-mono text-[12px]">{a.action}</span>
                    </p>
                    <p className="text-ink-500 truncate text-xs">
                      {a.entity}
                      {a.reason && <> · “{a.reason}”</>}
                    </p>
                  </div>
                  {a.actor.viaSupportSession && (
                    <Badge tone="purple" size="sm">
                      <LifeBuoy /> Support session
                    </Badge>
                  )}
                  <span className="text-ink-400 hidden text-xs whitespace-nowrap sm:block">{fmtDateTime(a.at)}</span>
                  <ChevronDown
                    className={cn('text-ink-300 size-4 transition-transform', open === a.id && 'rotate-180')}
                  />
                </button>
                <Collapse open={open === a.id}>
                  <div className="px-2 pb-4">
                    <Diff before={a.before} after={a.after} />
                  </div>
                </Collapse>
              </li>
            ))}
          </ul>
        )}
        {q.data && q.data.meta.total > PAGE && (
          <Pagination className="mt-4" page={page} pageSize={PAGE} total={q.data.meta.total} onPageChange={setPage} />
        )}
        {q.isError && (
          <Button className="mt-4" variant="secondary" onClick={() => q.refetch()}>
            Try again
          </Button>
        )}
      </Card>
    </ClientAdminOnly>
  );
}
