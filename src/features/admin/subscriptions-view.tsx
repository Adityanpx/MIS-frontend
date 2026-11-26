'use client';

import { CalendarPlus, RefreshCw, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DateField } from '@/components/date/date-field';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, SearchInput, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable, Pagination } from '@/components/ui/table';
import { diffDays, todayIST } from '@/lib/dates';
import { fmtDate, fmtMoney } from '@/lib/format';
import { SUBSCRIPTION_STATUSES } from '@/shared/enums';
import { cancelSubscriptionBody, extendSubscriptionBody, renewBody } from '@/shared/schemas/billing';
import {
  ALL,
  adminApi,
  check,
  ClientSelect,
  enumOptions,
  errorsOf,
  Fact,
  FilterBar,
  MoneyCell,
  NameCell,
  useA,
  useAList,
  useListState,
  useRun,
  withAll,
} from './kit';
import { ScheduleTable, YearlyAmounts } from './plants-view';
import type { AdminSubscription } from './types';

/** /admin/subscriptions — list, renew, extend, cancel (SUB-01…08). */
export function SubscriptionsView() {
  const sp = useSearchParams();
  const l = useListState({
    clientId: undefined as string | undefined,
    plantId: (sp.get('plantId') ?? undefined) as string | undefined,
    status: ALL as string,
    endingWithinDays: ALL as string,
  });
  const q = useAList<AdminSubscription>('/subscriptions', l.query);
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIST();
  return (
    <>
      <PageHeader
        title="Subscriptions"
        subtitle="One subscription per plant period — the source of the yearly invoices"
      />
      <FilterBar>
        <SearchInput
          className="w-full sm:w-60"
          placeholder="Client or plant…"
          value={l.q}
          onChange={(e) => l.search(e.target.value)}
        />
        <ClientSelect all className="w-56" value={l.filters.clientId} onChange={(v) => l.set('clientId', v)} />
        <Select
          className="w-40"
          size="sm"
          aria-label="Status"
          value={l.filters.status}
          onValueChange={(v) => l.set('status', v)}
          options={withAll('Any status', enumOptions(SUBSCRIPTION_STATUSES))}
        />
        <Select
          className="w-44"
          size="sm"
          aria-label="Ending"
          value={l.filters.endingWithinDays}
          onValueChange={(v) => l.set('endingWithinDays', v)}
          options={withAll(
            'Any end date',
            ['30', '60', '90', '180'].map((d) => ({ value: d, label: `Ending in ${d} days` })),
          )}
        />
        {l.filters.plantId && (
          <Button size="sm" variant="ghost" onClick={() => l.set('plantId', undefined)}>
            One plant ✕
          </Button>
        )}
      </FilterBar>
      <Card>
        <DataTable
          loading={q.isLoading}
          rows={q.data?.items}
          rowKey={(s) => s.id}
          onRowClick={(s) => setOpen(s.id)}
          empty="No subscriptions match."
          columns={[
            { key: 'p', header: 'Plant', cell: (s) => <NameCell name={s.plantName} sub={s.clientName} /> },
            {
              key: 'plan',
              header: 'Term',
              hideBelow: 'md',
              cell: (s) => (
                <NameCell name={`${s.plan.termYears} years`} sub={`${Number(s.plan.escalationPct)}% yearly hike`} />
              ),
            },
            {
              key: 'per',
              header: 'Period',
              cell: (s) => {
                const left = diffDays(s.endDate, today);
                return (
                  <div>
                    <p className="text-xs">
                      {fmtDate(s.startDate)} – {fmtDate(s.endDate)}
                    </p>
                    {s.status === 'active' && left <= 90 && left >= 0 && (
                      <p className="text-warning-600 text-xs font-medium">{left} days left</p>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'pr',
              header: 'Year 1 / yr',
              align: 'right',
              cell: (s) => (
                <span className="inline-flex items-center gap-1">
                  {s.customPricePerYear && (
                    <Badge size="sm" tone="purple">
                      Custom
                    </Badge>
                  )}
                  <MoneyCell v={s.pricePerYear} strong />
                </span>
              ),
            },
            { key: 's', header: 'Status', cell: (s) => <StatusBadge status={s.status} size="sm" /> },
          ]}
        />
        {q.data && (
          <Pagination page={l.page} pageSize={l.pageSize} total={q.data.meta.total} onPageChange={l.setPage} />
        )}
      </Card>
      {open && <SubscriptionDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

type Dlg = 'renew' | 'extend' | 'cancel';
function SubscriptionDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useA<AdminSubscription>(`/subscriptions/${id}`);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const s = q.data;
  const live = s && (s.status === 'active' || s.status === 'scheduled');
  return (
    <Drawer
      open
      width="xl"
      onOpenChange={(o) => !o && onClose()}
      title={s ? `${s.plantName} · ${s.plan.termYears} years` : 'Subscription'}
      description={s && `${s.clientName} · ${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`}
      footer={
        s && (
          <div className="flex w-full flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDlg('renew')}>
              <RefreshCw /> Renew
            </Button>
            <Button variant="secondary" disabled={!live} onClick={() => setDlg('extend')}>
              <CalendarPlus /> Extend
            </Button>
            <Button variant="danger-soft" className="ml-auto" disabled={!live} onClick={() => setDlg('cancel')}>
              <XCircle /> Cancel
            </Button>
          </div>
        )
      }
    >
      {!s ? (
        <Skeleton className="h-80 rounded-xl" />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-4">
            <Fact label="Status">
              <StatusBadge status={s.status} size="sm" />
            </Fact>
            <Fact label="Billing">{s.billingMode === 'upfront' ? 'Upfront' : 'Yearly'}</Fact>
            <Fact label="Year 1 amount">{fmtMoney(s.pricePerYear)}</Fact>
            <Fact label="Yearly hike">{`${Number(s.plan.escalationPct)}%`}</Fact>
            <Fact label="Total (ex GST)">{fmtMoney(s.totalExGst)}</Fact>
            <Fact label="Plant" className="sm:col-span-2">
              <Link className="text-brand-500" href={`/admin/plants/${s.plantId}`}>
                {s.plantName} ({s.plantCode})
              </Link>
            </Fact>
            <Fact label="Client" className="sm:col-span-2">
              <Link className="text-brand-500" href={`/admin/clients/${s.clientId}`}>
                {s.clientName}
              </Link>
            </Fact>
            {s.customReason && (
              <Fact label="Custom price reason" className="sm:col-span-4">
                <span className="whitespace-normal">{s.customReason}</span>
              </Fact>
            )}
          </div>
          {s.schedule && <ScheduleTable rows={s.schedule} />}
        </div>
      )}
      {s && dlg && <SubDialog sub={s} kind={dlg} onClose={() => setDlg(null)} />}
    </Drawer>
  );
}

function SubDialog({ sub, kind, onClose }: { sub: AdminSubscription; kind: Dlg; onClose: () => void }) {
  const [f, setF] = useState({
    startDate: null as string | null,
    termYears: String(sub.plan.termYears),
    renewPrice: '',
    escalationPct: String(Number(sub.plan.escalationPct)),
    addYears: '1',
    pricePerYear: '',
    reason: '',
    effectiveDate: null as string | null,
    unpaidInvoices: 'keep' as 'keep' | 'credit_note',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const t = (s: string) => s.trim() || undefined;
  const reason = f.reason.trim();

  const cfg = {
    renew: {
      title: 'Renew subscription',
      ok: 'Renewal created',
      schema: renewBody,
      path: '/subscriptions',
      body: {
        plantId: sub.plantId,
        startDate: f.startDate ?? undefined,
        termYears: f.termYears,
        pricePerYear: f.renewPrice.trim(),
        escalationPct: f.escalationPct.trim() || '0',
      },
    },
    extend: {
      title: 'Extend subscription',
      ok: 'Subscription extended',
      schema: extendSubscriptionBody,
      path: `/subscriptions/${sub.id}/extend`,
      body: { addYears: f.addYears, pricePerYear: t(f.pricePerYear), reason },
    },
    cancel: {
      title: 'Cancel subscription',
      ok: 'Subscription cancelled',
      schema: cancelSubscriptionBody,
      path: `/subscriptions/${sub.id}/cancel`,
      body: { reason, effectiveDate: f.effectiveDate ?? undefined, unpaidInvoices: f.unpaidInvoices },
    },
  }[kind];

  async function go() {
    const v = check<unknown>(cfg.schema, cfg.body);
    if (!v.ok) return setErrors(v.errors);
    try {
      await run(kind, () => adminApi.post(cfg.path, v.data), cfg.ok);
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  const reasonField = (
    <Field label="Reason" required hint="At least 10 characters" error={errors.reason} className="sm:col-span-2">
      <Textarea rows={2} value={f.reason} onChange={(e) => set('reason', e.target.value)} />
    </Field>
  );
  return (
    <Modal
      open
      size="lg"
      tone={kind === 'cancel' ? 'danger' : 'brand'}
      onOpenChange={(o) => !o && onClose()}
      title={cfg.title}
      description={`${sub.plantName} · ${sub.clientName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant={kind === 'cancel' ? 'danger' : 'primary'} onClick={go} loading={busy === kind}>
            {cfg.title}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === 'renew' && (
          <>
            <Field label="Subscription (years)" required hint="1 to 15" error={errors.termYears}>
              <Input inputMode="numeric" value={f.termYears} onChange={(e) => set('termYears', e.target.value)} />
            </Field>
            <Field label="Start" hint={`Default: ${fmtDate(sub.endDate)} + 1 day`} error={errors.startDate}>
              <DateField value={f.startDate} onChange={(d) => set('startDate', d)} clearable />
            </Field>
            <Field label="Amount per year (₹, ex GST)" required hint="Year 1 of the renewal" error={errors.pricePerYear}>
              <Input inputMode="decimal" value={f.renewPrice} onChange={(e) => set('renewPrice', e.target.value)} />
            </Field>
            <Field label="Yearly hike (%)" error={errors.escalationPct}>
              <Input inputMode="decimal" value={f.escalationPct} onChange={(e) => set('escalationPct', e.target.value)} />
            </Field>
            <YearlyAmounts years={f.termYears} price={f.renewPrice} hike={f.escalationPct} />
          </>
        )}
        {kind === 'extend' && (
          <>
            <Field label="Add years" required error={errors.addYears}>
              <Input inputMode="numeric" value={f.addYears} onChange={(e) => set('addYears', e.target.value)} />
            </Field>
            <Field
              label="Price per year for the new years (₹)"
              hint={`Empty = continue from ${fmtMoney(sub.pricePerYear)} with escalation`}
              error={errors.pricePerYear}
            >
              <Input inputMode="decimal" value={f.pricePerYear} onChange={(e) => set('pricePerYear', e.target.value)} />
            </Field>
            {reasonField}
          </>
        )}
        {kind === 'cancel' && (
          <>
            <Field label="Effective date" hint="Empty = today" error={errors.effectiveDate}>
              <DateField value={f.effectiveDate} onChange={(d) => set('effectiveDate', d)} clearable />
            </Field>
            <Field label="Unpaid invoices">
              <Select
                value={f.unpaidInvoices}
                onValueChange={(v) => set('unpaidInvoices', v as 'keep' | 'credit_note')}
                options={[
                  { value: 'keep', label: 'Keep — still to be paid' },
                  { value: 'credit_note', label: 'Cancel with credit notes' },
                ]}
              />
            </Field>
            {reasonField}
          </>
        )}
      </div>
    </Modal>
  );
}
