'use client';

import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarPlus,
  Check,
  Factory,
  Hand,
  Pencil,
  Play,
  Plus,
  Power,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DateField } from '@/components/date/date-field';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardMenu } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, SearchInput, Textarea } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable, Pagination } from '@/components/ui/table';
import { Segmented } from '@/components/ui/tabs';
import { addDays, todayIST } from '@/lib/dates';
import { fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PLANT_ACCOUNT_STATES, PLANT_TYPES, SETUP_STATUSES } from '@/shared/enums';
import { extendTenureBody, plantCreateBody, plantPatchBody } from '@/shared/schemas/admin';
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
  ReasonDialog,
  STATE_OPTIONS,
  useA,
  useAList,
  useListState,
  useRun,
  withAll,
} from './kit';
import type { AdminClient, AdminPlant, AdminPlantDetail, Plan, PlantPreview, ScheduleRow } from './types';

/** /admin/plants (PL-01) */
export function PlantsList() {
  const router = useRouter();
  const l = useListState({
    clientId: undefined as string | undefined,
    accountState: ALL as string,
    setupStatus: ALL as string,
  });
  const q = useAList<AdminPlant>('/plants', { ...l.query, sort: 'client' });
  return (
    <>
      <PageHeader
        title="Plants"
        subtitle="Every plant of every client, with contract and account state"
        actions={
          <Button asChild>
            <Link href="/admin/plants/new">
              <Plus /> New plant
            </Link>
          </Button>
        }
      />
      <FilterBar>
        <SearchInput
          className="w-full sm:w-64"
          placeholder="Plant name or code…"
          value={l.q}
          onChange={(e) => l.search(e.target.value)}
        />
        <ClientSelect all className="w-56" value={l.filters.clientId} onChange={(v) => l.set('clientId', v)} />
        <Select
          className="w-40"
          size="sm"
          aria-label="Setup"
          value={l.filters.setupStatus}
          onValueChange={(v) => l.set('setupStatus', v)}
          options={withAll('Any setup', enumOptions(SETUP_STATUSES))}
        />
        <Select
          className="w-40"
          size="sm"
          aria-label="Account"
          value={l.filters.accountState}
          onValueChange={(v) => l.set('accountState', v)}
          options={withAll('Any account', enumOptions(PLANT_ACCOUNT_STATES))}
        />
      </FilterBar>
      <Card>
        <DataTable
          loading={q.isLoading}
          rows={q.data?.items}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/admin/plants/${p.id}`)}
          empty="No plants match."
          columns={[
            {
              key: 'n',
              header: 'Plant',
              cell: (p) => <NameCell name={p.name} sub={`${p.code} · ${p.type} · ${fmtNum(p.capacityMld)} MLD`} />,
            },
            {
              key: 'c',
              header: 'Client',
              hideBelow: 'md',
              cell: (p) => <NameCell name={p.clientName} sub={p.clientCode} />,
            },
            {
              key: 'om',
              header: 'O&M ends',
              hideBelow: 'lg',
              cell: (p) => <span className="text-xs">{fmtDate(p.omEnd)}</span>,
            },
            {
              key: 'sub',
              header: 'Subscription',
              hideBelow: 'lg',
              cell: (p) => (
                <NameCell
                  name={p.planName ?? '—'}
                  sub={p.subscriptionEnd ? `till ${fmtDate(p.subscriptionEnd)}` : undefined}
                />
              ),
            },
            { key: 's', header: 'Setup', cell: (p) => <StatusBadge status={p.setupStatus} size="sm" /> },
            { key: 'a', header: 'Account', cell: (p) => <StatusBadge status={p.accountState} size="sm" /> },
          ]}
        />
        {q.data && (
          <Pagination page={l.page} pageSize={l.pageSize} total={q.data.meta.total} onPageChange={l.setPage} />
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- wizard

const WARN: Record<string, string> = {
  SUBSCRIPTION_ENDS_AFTER_OM_END: 'The subscription ends after the O&M contract — allowed, but check the term.',
  SELLER_STATE_NOT_CONFIGURED: 'Your company state is not set (Settings → Company), so the GST split is unknown.',
};
interface WizardState {
  clientId: string | undefined;
  name: string;
  code: string;
  type: string;
  capacityMld: string;
  city: string;
  stateCode: string | undefined;
  omStart: string | null;
  omTenureMonths: string;
  misStart: string | null;
  planId: string | undefined;
  subStart: string | null;
  billingMode: 'yearly' | 'upfront';
  customPrice: string;
  customReason: string;
}

/** /admin/plants/new — 4-step wizard: plant → contract → subscription → preview & create (PL-02, SUB-01). */
export function PlantWizard() {
  const router = useRouter();
  const sp = useSearchParams();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<WizardState>({
    clientId: sp.get('clientId') ?? undefined,
    name: '',
    code: '',
    type: 'STP',
    capacityMld: '',
    city: '',
    stateCode: undefined,
    omStart: todayIST(),
    omTenureMonths: '60',
    misStart: null,
    planId: undefined,
    subStart: null,
    billingMode: 'yearly',
    customPrice: '',
    customReason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PlantPreview | null>(null);
  const plans = useA<Plan[]>('/plans', { status: 'active' });
  const client = useA<AdminClient>(f.clientId ? `/clients/${f.clientId}` : null);
  const { run, busy } = useRun();
  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => setF((s) => ({ ...s, [k]: v }));
  const plan = plans.data?.find((p) => p.id === f.planId);

  const body = () => ({
    clientId: f.clientId,
    name: f.name.trim(),
    ...(f.code.trim() ? { code: f.code.trim().toUpperCase() } : {}),
    type: f.type,
    capacityMld: f.capacityMld,
    ...(f.city.trim() ? { city: f.city.trim() } : {}),
    stateCode: f.stateCode ?? client.data?.stateCode,
    omStart: f.omStart,
    omTenureMonths: f.omTenureMonths,
    ...(f.misStart ? { misStart: f.misStart } : {}),
    subscription: {
      planId: f.planId,
      startDate: f.subStart ?? f.misStart ?? f.omStart,
      billingMode: f.billingMode,
      ...(f.customPrice.trim()
        ? { customPricePerYear: f.customPrice.trim(), customReason: f.customReason.trim() }
        : {}),
    },
  });
  const STEP_FIELDS = [
    ['clientId', 'name', 'code', 'type', 'capacityMld', 'city', 'stateCode'],
    ['omStart', 'omTenureMonths', 'misStart'],
    ['subscription'],
  ];
  async function next() {
    const v = check(plantCreateBody, body());
    const errs = v.ok ? {} : v.errors;
    const mine = Object.keys(errs).filter((k) => STEP_FIELDS[step]?.some((p) => k === p || k.startsWith(`${p}.`)));
    if (mine.length) return setErrors(errs);
    setErrors({});
    if (step < 2) return setStep(step + 1);
    if (!v.ok) return setErrors(errs);
    try {
      const p = await run('preview', () => adminApi.post<PlantPreview>('/plants/preview', v.data));
      if (p) {
        setPreview(p);
        setStep(3);
      }
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  async function create() {
    const v = check(plantCreateBody, body());
    if (!v.ok) return setErrors(v.errors);
    try {
      const r = await run(
        'create',
        () => adminApi.post<AdminPlantDetail>('/plants', v.data),
        'Plant created — the Client Admin can now finish its settings',
      );
      if (r) router.push(`/admin/plants/${r.id}`);
    } catch (e) {
      setErrors(errorsOf(e));
      setStep(0);
    }
  }

  const steps = ['Plant', 'O&M contract', 'Subscription', 'Preview'];
  return (
    <>
      <PageHeader
        title="New plant"
        subtitle="Creates the plant, its contract years, the subscription and the invoice schedule"
        crumbs={[{ label: 'Plants', href: '/admin/plants' }, { label: 'New' }]}
      />
      <ol className="mb-6 flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <li
            key={s}
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
              i === step
                ? 'border-brand-500 bg-brand-50 text-brand-500 font-semibold'
                : i < step
                  ? 'border-success-100 bg-success-50 text-success-600'
                  : 'border-line text-ink-400',
            )}
          >
            <span className="grid size-5 place-items-center rounded-full bg-white text-xs">
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <Card className="max-w-4xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client" required error={errors.clientId} className="sm:col-span-2">
                  <ClientSelect value={f.clientId} onChange={(v) => set('clientId', v)} invalid={!!errors.clientId} />
                </Field>
                <Field label="Plant name" required error={errors.name}>
                  <Input value={f.name} onChange={(e) => set('name', e.target.value)} invalid={!!errors.name} />
                </Field>
                <Field label="Plant code" hint="Empty = automatic" error={errors.code}>
                  <Input className="uppercase" value={f.code} onChange={(e) => set('code', e.target.value)} />
                </Field>
                <Field label="Type" required>
                  <Segmented
                    value={f.type}
                    onChange={(v) => set('type', v)}
                    items={PLANT_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </Field>
                <Field label="Capacity (MLD)" required error={errors.capacityMld}>
                  <Input
                    inputMode="decimal"
                    value={f.capacityMld}
                    onChange={(e) => set('capacityMld', e.target.value)}
                    invalid={!!errors.capacityMld}
                  />
                </Field>
                <Field label="City" error={errors.city}>
                  <Input value={f.city} onChange={(e) => set('city', e.target.value)} />
                </Field>
                <Field label="State" required hint="Defaults to the client's state" error={errors.stateCode}>
                  <Select
                    value={f.stateCode ?? client.data?.stateCode}
                    onValueChange={(v) => set('stateCode', v)}
                    options={STATE_OPTIONS}
                  />
                </Field>
              </div>
            )}
            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="O&M start" required error={errors.omStart}>
                  <DateField value={f.omStart} onChange={(d) => set('omStart', d)} />
                </Field>
                <Field label="Tenure (months)" required hint="Up to 180" error={errors.omTenureMonths}>
                  <Input
                    inputMode="numeric"
                    value={f.omTenureMonths}
                    onChange={(e) => set('omTenureMonths', e.target.value)}
                  />
                </Field>
                <Field label="MIS start" hint="First logsheet date (default: O&M start)" error={errors.misStart}>
                  <DateField value={f.misStart} onChange={(d) => set('misStart', d)} clearable />
                </Field>
                <p className="text-ink-500 text-sm sm:col-span-3">
                  Contract years run from the O&M start for {fmtNum(Math.ceil(Number(f.omTenureMonths || 0) / 12))}{' '}
                  year(s). Fees per year are set by the Client Admin in Settings → Contract.
                </p>
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plan" required error={errors['subscription.planId']} className="sm:col-span-2">
                  <Select
                    value={f.planId}
                    onValueChange={(v) => set('planId', v)}
                    invalid={!!errors['subscription.planId']}
                    options={(plans.data ?? []).map((p) => ({
                      value: p.id,
                      label: `${p.name} · ${p.termYears} years`,
                      hint: `${fmtMoney(p.pricePerYear)}/yr`,
                    }))}
                  />
                </Field>
                <Field label="Subscription start" hint="Default: MIS start" error={errors['subscription.startDate']}>
                  <DateField value={f.subStart} onChange={(d) => set('subStart', d)} clearable />
                </Field>
                <Field label="Billing">
                  <Segmented
                    value={f.billingMode}
                    onChange={(v) => set('billingMode', v)}
                    items={[
                      { value: 'yearly', label: 'Yearly' },
                      { value: 'upfront', label: `Upfront${plan ? ` (−${plan.upfrontDiscountPct}%)` : ''}` },
                    ]}
                  />
                </Field>
                <Field
                  label="Custom price per year (₹)"
                  hint={plan ? `Plan price ${fmtMoney(plan.pricePerYear)}` : 'Optional'}
                  error={errors['subscription.customPricePerYear']}
                >
                  <Input
                    inputMode="decimal"
                    value={f.customPrice}
                    onChange={(e) => set('customPrice', e.target.value)}
                  />
                </Field>
                {f.customPrice.trim() && (
                  <Field label="Reason for the custom price" required error={errors['subscription.customReason']}>
                    <Input value={f.customReason} onChange={(e) => set('customReason', e.target.value)} />
                  </Field>
                )}
              </div>
            )}
            {step === 3 && preview && <PreviewPanel p={preview} />}
          </motion.div>
        </AnimatePresence>
        {errors._ && <p className="text-danger-600 mt-4 text-sm">{errors._}</p>}
        <div className="border-line mt-6 flex justify-between border-t pt-5">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
            <ArrowLeft /> Back
          </Button>
          {step < 3 ? (
            <Button onClick={next} loading={busy === 'preview'}>
              {step === 2 ? 'Preview' : 'Next'} <ArrowRight />
            </Button>
          ) : (
            <Button onClick={create} loading={busy === 'create'}>
              <Factory /> Create plant
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}

function PreviewPanel({ p }: { p: PlantPreview }) {
  return (
    <div className="space-y-6">
      {p.warnings.map((w) => (
        <p key={w} className="rounded-inner bg-warning-50 text-warning-600 flex items-center gap-2 p-3 text-sm">
          <AlertTriangle className="size-4 shrink-0" /> {WARN[w] ?? w}
        </p>
      ))}
      <div className="grid gap-5 sm:grid-cols-4">
        <Fact label="O&M">{`${fmtDate(p.plant.omStart)} – ${fmtDate(p.plant.omEnd)}`}</Fact>
        <Fact label="MIS start">{fmtDate(p.plant.misStart)}</Fact>
        <Fact label="Plan">{`${p.subscription.planName} · ${p.subscription.termYears} yrs`}</Fact>
        <Fact label="Contract value (ex GST)">{fmtMoney(p.subscription.totalExGst)}</Fact>
      </div>
      <ScheduleTable rows={p.schedule} />
      <div className="rounded-inner bg-canvas grid gap-4 p-4 sm:grid-cols-4">
        <Fact label="First invoice on">{fmtDate(p.firstInvoice.plannedInvoiceDate)}</Fact>
        <Fact label="Taxable">{fmtMoney(p.firstInvoice.taxable)}</Fact>
        <Fact
          label={
            p.firstInvoice.gstType === 'igst'
              ? `IGST ${p.firstInvoice.ratePct}%`
              : `CGST + SGST ${p.firstInvoice.ratePct}%`
          }
        >
          {fmtMoney(p.firstInvoice.gst)}
        </Fact>
        <Fact label="Total">{fmtMoney(p.firstInvoice.total)}</Fact>
      </div>
    </div>
  );
}

export function ScheduleTable({ rows }: { rows: ScheduleRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      dense
      rows={rows}
      rowKey={(r) => String(r.yearNo)}
      onRowClick={(r) => r.invoiceId && router.push(`/admin/invoices/${r.invoiceId}`)}
      columns={[
        { key: 'y', header: 'Year', cell: (r) => <span className="font-semibold">Year {r.yearNo}</span> },
        {
          key: 'p',
          header: 'Period',
          cell: (r) => (
            <span className="text-xs">
              {fmtDate(r.periodFrom)} – {fmtDate(r.periodTo)}
            </span>
          ),
        },
        {
          key: 'i',
          header: 'Invoice on',
          hideBelow: 'md',
          cell: (r) => <span className="text-xs">{fmtDate(r.plannedInvoiceDate)}</span>,
        },
        {
          key: 'd',
          header: 'Due',
          hideBelow: 'md',
          cell: (r) => <span className="text-xs">{fmtDate(r.dueDate)}</span>,
        },
        { key: 'a', header: 'Amount (ex GST)', align: 'right', cell: (r) => <MoneyCell v={r.amount} strong /> },
        {
          key: 's',
          header: '',
          cell: (r) =>
            r.status ? (
              <Badge size="sm" tone={r.status === 'invoiced' ? 'success' : 'neutral'}>
                {r.status === 'invoiced' ? 'Invoiced' : 'Planned'}
              </Badge>
            ) : null,
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------- detail

type PlantAct = 'close' | 'suspend' | 'reactivate' | 'hold';
/** /admin/plants/:id (PL-03…PL-07) */
export function PlantDetail({ id }: { id: string }) {
  const q = useA<AdminPlantDetail>(`/plants/${id}`);
  const [edit, setEdit] = useState(false);
  const [extend, setExtend] = useState(false);
  const [act, setAct] = useState<PlantAct | null>(null);
  const { run } = useRun();
  const p = q.data;
  if (q.error) return <EmptyState title="Plant not found" />;
  if (!p) return <Skeleton className="rounded-card h-[480px]" />;
  const closed = p.setupStatus === 'closed';
  const conf: Record<
    PlantAct,
    { title: string; confirm: string; tone: 'danger' | 'warning' | 'success'; description: string }
  > = {
    close: {
      title: 'Close plant',
      confirm: 'Close plant',
      tone: 'danger',
      description: 'The plant becomes read-only for good (contract handed over). Planned invoices stop.',
    },
    suspend: {
      title: 'Suspend plant',
      confirm: 'Suspend',
      tone: 'danger',
      description: 'Users of this plant are blocked until you reactivate it.',
    },
    reactivate: {
      title: 'Reactivate plant',
      confirm: 'Reactivate',
      tone: 'success',
      description: 'Removes the manual suspension.',
    },
    hold: {
      title: 'Hold state changes',
      confirm: 'Save hold',
      tone: 'warning',
      description: 'Pauses automatic grace → read-only → suspended changes. Empty date = remove the hold.',
    },
  };
  const s = p.subscription;
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Plants', href: '/admin/plants' },
          { label: p.clientName, href: `/admin/clients/${p.clientId}` },
          { label: p.code },
        ]}
        title={p.name}
        badge={
          <span className="flex gap-1.5">
            <StatusBadge status={p.setupStatus} />
            <StatusBadge status={p.accountState} />
            {p.holdUntil && <Badge tone="purple">On hold till {fmtDate(p.holdUntil)}</Badge>}
          </span>
        }
        subtitle={`${p.clientName} · ${p.type} · ${fmtNum(p.capacityMld)} MLD${p.city ? ` · ${p.city}` : ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEdit(true)} disabled={closed}>
              <Pencil /> Edit
            </Button>
            <Button variant="secondary" onClick={() => setExtend(true)} disabled={closed}>
              <CalendarPlus /> Extend O&M
            </Button>
            <CardMenu
              items={[
                {
                  label: 'Hold state changes',
                  icon: <Hand className="size-4" />,
                  disabled: closed,
                  onSelect: () => setAct('hold'),
                },
                p.manualSuspended
                  ? { label: 'Reactivate', icon: <Play className="size-4" />, onSelect: () => setAct('reactivate') }
                  : {
                      label: 'Suspend',
                      icon: <Ban className="size-4" />,
                      danger: true,
                      disabled: closed,
                      onSelect: () => setAct('suspend'),
                    },
                {
                  label: 'Close plant',
                  icon: <Power className="size-4" />,
                  danger: true,
                  disabled: closed,
                  onSelect: () => setAct('close'),
                },
              ]}
            />
          </>
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Contract" subtitle={`${fmtNum(p.omTenureMonths)} months`} />
            <div className="grid gap-5 sm:grid-cols-4">
              <Fact label="O&M start">{fmtDate(p.omStart)}</Fact>
              <Fact label="O&M end">{fmtDate(p.omEnd)}</Fact>
              <Fact label="MIS start">{fmtDate(p.misStart)}</Fact>
              <Fact label="Closed">{p.closedAt ? fmtDate(p.closedAt) : '—'}</Fact>
            </div>
            <DataTable
              className="mt-5"
              dense
              rows={p.contractYears}
              rowKey={(y) => String(y.yearNo)}
              columns={[
                {
                  key: 'y',
                  header: 'Contract year',
                  cell: (y) => <span className="font-semibold">Year {y.yearNo}</span>,
                },
                {
                  key: 'p',
                  header: 'Period',
                  cell: (y) => (
                    <span className="text-xs">
                      {fmtDate(y.startDate)} – {fmtDate(y.endDate)}
                    </span>
                  ),
                },
                { key: 'd', header: 'Days', align: 'right', hideBelow: 'md', cell: (y) => fmtNum(y.days) },
                {
                  key: 'f',
                  header: 'Fixed fee',
                  align: 'right',
                  cell: (y) =>
                    y.feeConfigured ? (
                      <MoneyCell v={y.fixedFee} />
                    ) : (
                      <Badge size="sm" tone="warning">
                        Not set
                      </Badge>
                    ),
                },
              ]}
            />
          </Card>
          {s?.schedule && s.schedule.length > 0 && (
            <Card>
              <CardHeader title="Invoice schedule" subtitle="Click an invoiced year to open the invoice" />
              <ScheduleTable rows={s.schedule} />
            </Card>
          )}
        </div>
        <Card>
          <CardHeader
            title="Subscription"
            action={
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/admin/subscriptions?plantId=${p.id}`}>Manage</Link>
              </Button>
            }
          />
          {!s ? (
            <EmptyState compact title="No subscription" />
          ) : (
            <div className="grid grid-cols-2 gap-5">
              <Fact label="Plan" className="col-span-2">{`${s.plan.name} · ${s.plan.termYears} years`}</Fact>
              <Fact label="Period" className="col-span-2">{`${fmtDate(s.startDate)} – ${fmtDate(s.endDate)}`}</Fact>
              <Fact label="Price per year">{fmtMoney(s.pricePerYear)}</Fact>
              <Fact label="Billing">{s.billingMode === 'upfront' ? 'Upfront' : 'Yearly'}</Fact>
              <Fact label="Status">
                <StatusBadge status={s.status} size="sm" />
              </Fact>
              <Fact label="Total (ex GST)">{fmtMoney(s.totalExGst)}</Fact>
              {s.customReason && (
                <Fact label="Custom price reason" className="col-span-2">
                  <span className="whitespace-normal">{s.customReason}</span>
                </Fact>
              )}
            </div>
          )}
        </Card>
      </div>
      {edit && <EditPlantDrawer plant={p} onClose={() => setEdit(false)} />}
      {extend && <ExtendDialog plant={p} onClose={() => setExtend(false)} />}
      {act && (
        <ReasonDialog
          open
          onClose={() => setAct(null)}
          {...conf[act]}
          dateLabel={act === 'hold' ? 'Hold until' : undefined}
          onConfirm={({ reason, date }) =>
            run(
              act,
              () => adminApi.post(`/plants/${p.id}/${act}`, act === 'hold' ? { until: date, reason } : { reason }),
              `${conf[act].confirm} — done`,
            )
          }
        />
      )}
    </>
  );
}

function EditPlantDrawer({ plant, onClose }: { plant: AdminPlantDetail; onClose: () => void }) {
  const [f, setF] = useState({
    name: plant.name,
    type: plant.type,
    capacityMld: String(plant.capacityMld),
    city: plant.city ?? '',
    stateCode: plant.stateCode,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  async function save() {
    const v = check(plantPatchBody, { ...f, name: f.name.trim(), city: f.city.trim() || null });
    if (!v.ok) return setErrors(v.errors);
    try {
      await run('save', () => adminApi.patch(`/plants/${plant.id}`, v.data), 'Plant saved');
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit plant"
      footer={
        <Button block onClick={save} loading={busy === 'save'}>
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required error={errors.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Type">
          <Select
            value={f.type}
            onValueChange={(v) => setF({ ...f, type: v })}
            options={PLANT_TYPES.map((t) => ({ value: t, label: t }))}
          />
        </Field>
        <Field label="Capacity (MLD)" error={errors.capacityMld}>
          <Input
            inputMode="decimal"
            value={f.capacityMld}
            onChange={(e) => setF({ ...f, capacityMld: e.target.value })}
          />
        </Field>
        <Field label="City">
          <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        </Field>
        <Field label="State" hint="Changes the GST type of future invoices">
          <Select value={f.stateCode} onValueChange={(v) => setF({ ...f, stateCode: v })} options={STATE_OPTIONS} />
        </Field>
      </div>
    </Drawer>
  );
}

function ExtendDialog({ plant, onClose }: { plant: AdminPlantDetail; onClose: () => void }) {
  const [months, setMonths] = useState(String(plant.omTenureMonths + 12));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  const newEnd = addDays(plant.omEnd, Math.round((Number(months) - plant.omTenureMonths) * 30.44));
  async function go() {
    const v = check(extendTenureBody, { omTenureMonths: months, reason: reason.trim() });
    if (!v.ok) return setErrors(v.errors);
    try {
      await run('extend', () => adminApi.post(`/plants/${plant.id}/extend-tenure`, v.data), 'O&M tenure extended');
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      title="Extend O&M tenure"
      description={`Now ${plant.omTenureMonths} months, ends ${fmtDate(plant.omEnd)}`}
      footer={
        <Button block onClick={go} loading={busy === 'extend'}>
          Extend
        </Button>
      }
    >
      <div className="space-y-4">
        <Field
          label="New total tenure (months)"
          required
          hint={`New end ≈ ${fmtDate(newEnd)} (new contract years are added)`}
          error={errors.omTenureMonths}
        >
          <Input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
        </Field>
        <Field label="Reason" required error={errors.reason}>
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Drawer>
  );
}
