'use client';

import { Building2, Plus, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, SearchInput, Textarea } from '@/components/ui/input';
import { Avatar, Switch } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable, Pagination } from '@/components/ui/table';
import { fmtDate, fmtNum } from '@/lib/format';
import { CLIENT_ACCOUNT_STATES } from '@/shared/enums';
import { clientCreateBody, clientPatchBody } from '@/shared/schemas/admin';
import {
  ALL,
  adminApi,
  check,
  enumOptions,
  errorsOf,
  FilterBar,
  NameCell,
  STATE_OPTIONS,
  useAList,
  useListState,
  useRun,
  withAll,
} from './kit';
import type { AdminClient } from './types';

/** /admin/clients — every client with state, plants and users (CL-01). */
export function ClientsList() {
  const router = useRouter();
  const l = useListState({ accountState: ALL as string, stateCode: ALL as string });
  const q = useAList<AdminClient>('/clients', { ...l.query, sort: 'name' });
  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Companies using OMMIS — open one for plants, users, billing and support"
        actions={
          <Button asChild>
            <Link href="/admin/clients/new">
              <Plus /> New client
            </Link>
          </Button>
        }
      />
      <FilterBar>
        <SearchInput
          className="w-full sm:w-72"
          placeholder="Name, code or GSTIN…"
          value={l.q}
          onChange={(e) => l.search(e.target.value)}
        />
        <Select
          className="w-44"
          size="sm"
          aria-label="Account state"
          value={l.filters.accountState}
          onValueChange={(v) => l.set('accountState', v)}
          options={withAll('All states', enumOptions(CLIENT_ACCOUNT_STATES))}
        />
        <Select
          className="w-52"
          size="sm"
          aria-label="State"
          value={l.filters.stateCode}
          onValueChange={(v) => l.set('stateCode', v)}
          options={withAll('All of India', STATE_OPTIONS)}
        />
      </FilterBar>
      <Card>
        <DataTable
          loading={q.isLoading}
          rows={q.data?.items}
          rowKey={(c) => c.id}
          onRowClick={(c) => router.push(`/admin/clients/${c.id}`)}
          empty="No clients match."
          columns={[
            {
              key: 'name',
              header: 'Client',
              cell: (c) => (
                <div className="flex items-center gap-3">
                  <Avatar name={c.displayName} src={c.logoUrl} size={36} />
                  <NameCell name={c.displayName} sub={`${c.code} · ${c.legalName}`} />
                </div>
              ),
            },
            {
              key: 'state',
              header: 'State',
              hideBelow: 'md',
              cell: (c) => <span className="text-ink-500 text-xs">{c.stateName}</span>,
            },
            {
              key: 'gstin',
              header: 'GSTIN',
              hideBelow: 'lg',
              cell: (c) => <span className="tabular text-xs">{c.gstin ?? '—'}</span>,
            },
            {
              key: 'plants',
              header: 'Plants',
              align: 'right',
              cell: (c) => <span className="tabular">{fmtNum(c.plantsCount)}</span>,
            },
            {
              key: 'users',
              header: 'Users',
              align: 'right',
              hideBelow: 'sm',
              cell: (c) => <span className="tabular">{fmtNum(c.usersCount)}</span>,
            },
            {
              key: 'acc',
              header: 'Account',
              cell: (c) => (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={c.accountState} size="sm" />
                  {c.status !== 'active' && <StatusBadge status={c.status} size="sm" />}
                  {c.holdUntil && (
                    <Badge size="sm" tone="purple">
                      On hold
                    </Badge>
                  )}
                </div>
              ),
            },
            {
              key: 'since',
              header: 'Since',
              hideBelow: 'lg',
              cell: (c) => <span className="text-ink-500 text-xs">{fmtDate(c.createdAt)}</span>,
            },
          ]}
        />
        {q.data && (
          <Pagination page={l.page} pageSize={l.pageSize} total={q.data.meta.total} onPageChange={l.setPage} />
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- create / edit form

interface FormState {
  code: string;
  displayName: string;
  legalName: string;
  gstin: string;
  pan: string;
  stateCode: string;
  line1: string;
  line2: string;
  city: string;
  pin: string;
  contactName: string;
  contactEmail: string;
  contactMobile: string;
  billingEmails: string;
  notes: string;
  force2fa: boolean;
  adminName: string;
  adminEmail: string;
  adminMobile: string;
}
const fromClient = (c?: AdminClient): FormState => ({
  code: c?.code ?? '',
  displayName: c?.displayName ?? '',
  legalName: c?.legalName ?? '',
  gstin: c?.gstin ?? '',
  pan: c?.pan ?? '',
  stateCode: c?.stateCode ?? '',
  line1: c?.address.line1 ?? '',
  line2: c?.address.line2 ?? '',
  city: c?.address.city ?? '',
  pin: c?.address.pin ?? '',
  contactName: c?.primaryContact.name ?? '',
  contactEmail: c?.primaryContact.email ?? '',
  contactMobile: c?.primaryContact.mobile ?? '',
  billingEmails: c?.billingEmails.join(', ') ?? '',
  notes: c?.notes ?? '',
  force2fa: c?.force2fa ?? false,
  adminName: '',
  adminEmail: '',
  adminMobile: '',
});
const u = (s: string) => (s.trim() ? s.trim() : undefined);

function toBody(f: FormState, create: boolean) {
  const base = {
    displayName: f.displayName.trim(),
    legalName: f.legalName.trim(),
    stateCode: f.stateCode,
    address: {
      line1: f.line1.trim(),
      ...(u(f.line2) ? { line2: f.line2.trim() } : {}),
      city: f.city.trim(),
      pin: f.pin.trim(),
    },
    primaryContact: {
      name: f.contactName.trim(),
      email: f.contactEmail.trim(),
      ...(u(f.contactMobile) ? { mobile: f.contactMobile.trim() } : {}),
    },
    billingEmails: f.billingEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean),
    force2fa: f.force2fa,
  };
  if (create)
    return {
      ...base,
      ...(u(f.gstin) ? { gstin: f.gstin.trim().toUpperCase() } : {}),
      ...(u(f.pan) ? { pan: f.pan.trim().toUpperCase() } : {}),
      ...(u(f.notes) ? { notes: f.notes.trim() } : {}),
      ...(u(f.code) ? { code: f.code.trim().toUpperCase() } : {}),
      firstAdmin: {
        name: f.adminName.trim(),
        email: f.adminEmail.trim(),
        ...(u(f.adminMobile) ? { mobile: f.adminMobile.trim() } : {}),
      },
    };
  return {
    ...base,
    gstin: u(f.gstin)?.toUpperCase() ?? null,
    pan: u(f.pan)?.toUpperCase() ?? null,
    notes: u(f.notes) ?? null,
  };
}

/** Client form used by "New client" (with the first Client Admin) and the Edit drawer. */
export function ClientForm({ client, onDone }: { client?: AdminClient; onDone: (c: AdminClient) => void }) {
  const create = !client;
  const [f, setF] = useState<FormState>(() => fromClient(client));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const e = (k: string) => errors[k];

  async function save() {
    const body = toBody(f, create);
    const v = create ? check(clientCreateBody, body) : check(clientPatchBody, body);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    try {
      const r = await run(
        'save',
        () =>
          create
            ? adminApi.post<AdminClient>('/clients', v.data)
            : adminApi.patch<AdminClient>(`/clients/${client.id}`, v.data),
        create ? 'Client created — the invitation e-mail is on its way' : 'Client saved',
      );
      if (r) onDone(r);
    } catch (err) {
      setErrors(errorsOf(err));
    }
  }

  const txt = (
    k: keyof FormState,
    label: string,
    opts: { err?: string; required?: boolean; placeholder?: string; type?: string; upper?: boolean } = {},
  ) => (
    <Field label={label} required={opts.required} error={e(opts.err ?? String(k))}>
      <Input
        type={opts.type}
        value={String(f[k])}
        placeholder={opts.placeholder}
        className={opts.upper ? 'uppercase' : undefined}
        onChange={(ev) => set(k, ev.target.value as never)}
        invalid={!!e(opts.err ?? String(k))}
      />
    </Field>
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        {txt('displayName', 'Display name', { required: true })}
        {txt('legalName', 'Legal name (on invoices)', { required: true })}
        {create && txt('code', 'Client code', { placeholder: 'Auto (e.g. ACME-01)', upper: true })}
        <Field label="State" required error={e('stateCode')}>
          <Select
            value={f.stateCode || undefined}
            onValueChange={(v) => set('stateCode', v)}
            options={STATE_OPTIONS}
            invalid={!!e('stateCode')}
          />
        </Field>
        {txt('gstin', 'GSTIN', { upper: true, placeholder: 'Optional — 15 characters' })}
        {txt('pan', 'PAN', { upper: true, placeholder: 'Optional' })}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <p className="text-ink-900 text-sm font-semibold sm:col-span-2">Address</p>
        {txt('line1', 'Line 1', { required: true, err: 'address.line1' })}
        {txt('line2', 'Line 2', { err: 'address.line2' })}
        {txt('city', 'City', { required: true, err: 'address.city' })}
        {txt('pin', 'PIN code', { required: true, err: 'address.pin' })}
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        <p className="text-ink-900 text-sm font-semibold sm:col-span-2">Contact and invoices</p>
        {txt('contactName', 'Primary contact', { required: true, err: 'primaryContact.name' })}
        {txt('contactEmail', 'Contact e-mail', { required: true, type: 'email', err: 'primaryContact.email' })}
        {txt('contactMobile', 'Contact mobile', { err: 'primaryContact.mobile' })}
        <Field
          label="Invoice e-mails"
          required
          hint="1–3 addresses, comma separated"
          error={e('billingEmails') ?? e('billingEmails.0')}
        >
          <Input
            value={f.billingEmails}
            onChange={(ev) => set('billingEmails', ev.target.value)}
            invalid={!!e('billingEmails')}
          />
        </Field>
        <Field label="Internal notes" className="sm:col-span-2" error={e('notes')}>
          <Textarea rows={2} value={f.notes} onChange={(ev) => set('notes', ev.target.value)} />
        </Field>
        <label className="rounded-inner border-line flex items-center justify-between gap-3 border p-3 sm:col-span-2">
          <span>
            <span className="text-ink-900 block text-sm font-medium">Require two-step sign-in</span>
            <span className="text-ink-400 text-xs">Every user of this client must set up an authenticator app.</span>
          </span>
          <Switch
            checked={f.force2fa}
            onCheckedChange={(v) => set('force2fa', v)}
            aria-label="Require two-step sign-in"
          />
        </label>
      </section>
      {create && (
        <section className="grid gap-4 sm:grid-cols-2">
          <p className="text-ink-900 text-sm font-semibold sm:col-span-2">First Client Admin (gets the invitation)</p>
          {txt('adminName', 'Name', { required: true, err: 'firstAdmin.name' })}
          {txt('adminEmail', 'E-mail', { required: true, type: 'email', err: 'firstAdmin.email' })}
          {txt('adminMobile', 'Mobile', { err: 'firstAdmin.mobile' })}
        </section>
      )}
      <div className="flex justify-end">
        <Button onClick={save} loading={busy === 'save'}>
          <Save /> {create ? 'Create client' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

/** /admin/clients/new */
export function NewClientPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader
        title="New client"
        subtitle="Create the company and invite its first Client Admin. Add plants next."
        crumbs={[{ label: 'Clients', href: '/admin/clients' }, { label: 'New' }]}
      />
      <Card className="max-w-4xl">
        <CardHeader
          icon={<Building2 />}
          title="Company details"
          subtitle="Legal name, state and GSTIN drive the invoices (CGST + SGST or IGST)."
        />
        <ClientForm onDone={(c) => router.push(`/admin/clients/${c.id}`)} />
      </Card>
    </>
  );
}
