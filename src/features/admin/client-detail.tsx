'use client';

import {
  Archive,
  Ban,
  Download,
  Eye,
  FileUp,
  Hand,
  KeyRound,
  MailPlus,
  Pencil,
  Play,
  Plus,
  Power,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardMenu } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, Skeleton, Switch } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable, Pagination } from '@/components/ui/table';
import { Segmented, Tabs } from '@/components/ui/tabs';
import { DateField } from '@/components/date/date-field';
import { todayIST } from '@/lib/dates';
import { fmtDate, fmtDateTime, fmtMoney, fmtNum, fmtRelative } from '@/lib/format';
import { DOCUMENT_TYPES, OFFLINE_PAYMENT_MODES } from '@/shared/enums';
import { userInviteBody } from '@/shared/schemas/company';
import { actAsBody, refundBody } from '@/shared/schemas/billing';
import { ClientForm } from './clients-view';
import {
  adminApi,
  adminDownload,
  check,
  enumOptions,
  errorsOf,
  Fact,
  labelize,
  MoneyCell,
  NameCell,
  ReasonDialog,
  toastError,
  useA,
  useAList,
  useRun,
} from './kit';
import { UsageTable } from './usage-view';
import type {
  ActAsSession,
  AdminClient,
  AdminInvoice,
  AdminPlant,
  ClientDocument,
  ClientUser,
  LifecycleEvent,
  UsageRow,
} from './types';

type Tab = 'overview' | 'plants' | 'users' | 'billing' | 'documents' | 'history' | 'usage' | 'support' | 'data';

/** /admin/clients/:id — one client with every tab of CL-02…CL-12. */
export function ClientDetail({ id }: { id: string }) {
  const c = useA<AdminClient>(`/clients/${id}`);
  const [tab, setTab] = useState<Tab>('overview');
  const client = c.data;
  if (c.error)
    return (
      <EmptyState
        title="Client not found"
        description="It may have been deleted."
        action={
          <Button asChild variant="secondary">
            <Link href="/admin/clients">Back to clients</Link>
          </Button>
        }
      />
    );
  if (!client) return <Skeleton className="rounded-card h-[480px]" />;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Clients', href: '/admin/clients' }, { label: client.code }]}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={client.displayName} src={client.logoUrl} size={40} /> {client.displayName}
          </span>
        }
        badge={
          <span className="flex gap-1.5">
            <StatusBadge status={client.accountState} />
            {client.status !== 'active' && <StatusBadge status={client.status} />}
            {client.holdUntil && <Badge tone="purple">On hold till {fmtDate(client.holdUntil)}</Badge>}
          </span>
        }
        subtitle={`${client.legalName} · ${client.stateName}`}
        actions={<LifecycleActions client={client} />}
      />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'plants', label: 'Plants', count: client.plantsCount },
          { value: 'users', label: 'Users', count: client.usersCount },
          { value: 'billing', label: 'Billing & credit' },
          { value: 'documents', label: 'Documents' },
          { value: 'history', label: 'Lifecycle' },
          { value: 'usage', label: 'Usage' },
          { value: 'support', label: 'Support access' },
          { value: 'data', label: 'Data' },
        ]}
      />
      {tab === 'overview' && <Overview client={client} />}
      {tab === 'plants' && <PlantsTab client={client} />}
      {tab === 'users' && <UsersTab client={client} />}
      {tab === 'billing' && <BillingTab client={client} />}
      {tab === 'documents' && <DocumentsTab client={client} />}
      {tab === 'history' && <HistoryTab client={client} />}
      {tab === 'usage' && <UsageTab client={client} />}
      {tab === 'support' && <SupportTab client={client} />}
      {tab === 'data' && <DataTab client={client} />}
    </>
  );
}

// ---------------------------------------------------------------- lifecycle actions

type Act = 'suspend' | 'reactivate' | 'hold' | 'terminate';
function LifecycleActions({ client }: { client: AdminClient }) {
  const [act, setAct] = useState<Act | null>(null);
  const { run } = useRun();
  const base = `/clients/${client.id}`;
  const conf: Record<
    Act,
    { title: string; confirm: string; tone: 'warning' | 'danger' | 'success'; description: string }
  > = {
    suspend: {
      title: 'Suspend client',
      confirm: 'Suspend',
      tone: 'danger',
      description: 'Users can no longer sign in. Data is kept.',
    },
    reactivate: {
      title: 'Reactivate client',
      confirm: 'Reactivate',
      tone: 'success',
      description: 'Removes the manual suspension and recalculates the state.',
    },
    hold: {
      title: 'Hold state changes',
      confirm: 'Save hold',
      tone: 'warning',
      description:
        'Pauses automatic grace → read-only → suspended changes (e.g. a cheque on the way). Leave the date empty to remove the hold.',
    },
    terminate: {
      title: 'Terminate client',
      confirm: 'Terminate',
      tone: 'danger',
      description:
        'Ends every plant and schedules the data for deletion after the retention period. Exports stay possible until then.',
    },
  };
  const terminated = client.accountState === 'terminated';
  return (
    <>
      <Button variant="secondary" onClick={() => setAct('hold')} disabled={terminated}>
        <Hand /> Hold
      </Button>
      {client.manualSuspended ? (
        <Button variant="secondary" onClick={() => setAct('reactivate')}>
          <Play /> Reactivate
        </Button>
      ) : (
        <Button variant="danger-soft" onClick={() => setAct('suspend')} disabled={terminated}>
          <Ban /> Suspend
        </Button>
      )}
      <CardMenu
        items={[
          {
            label: 'Terminate client',
            icon: <Power className="size-4" />,
            danger: true,
            disabled: terminated,
            onSelect: () => setAct('terminate'),
          },
        ]}
      />
      {act && (
        <ReasonDialog
          open
          onClose={() => setAct(null)}
          {...conf[act]}
          dateLabel={act === 'hold' ? 'Hold until' : undefined}
          onConfirm={({ reason, date }) =>
            run(
              act,
              () => adminApi.post(`${base}/${act}`, act === 'hold' ? { until: date, reason } : { reason }),
              `${conf[act].confirm} — done`,
            )
          }
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- overview

function Overview({ client }: { client: AdminClient }) {
  const [edit, setEdit] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const { run, busy } = useRun();
  async function logo(f: File | undefined) {
    if (!f) return;
    const form = new FormData();
    form.append('file', f);
    await run('logo', () => adminApi.upload(`/clients/${client.id}/logo`, form), 'Logo updated').catch(toastError);
  }
  const a = client.address;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader
          title="Company"
          action={
            <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>
              <Pencil /> Edit
            </Button>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Code">{client.code}</Fact>
          <Fact label="Legal name">{client.legalName}</Fact>
          <Fact label="State">{`${client.stateName} (${client.stateCode})`}</Fact>
          <Fact label="GSTIN">{client.gstin}</Fact>
          <Fact label="PAN">{client.pan}</Fact>
          <Fact label="Two-step sign-in">{client.force2fa ? 'Required' : 'Optional'}</Fact>
          <Fact label="Address" className="sm:col-span-2 lg:col-span-3">
            {[a.line1, a.line2, a.city, a.pin].filter(Boolean).join(', ')}
          </Fact>
          <Fact label="Primary contact">{client.primaryContact.name}</Fact>
          <Fact label="Contact e-mail">{client.primaryContact.email}</Fact>
          <Fact label="Contact mobile">{client.primaryContact.mobile}</Fact>
          <Fact label="Invoice e-mails" className="sm:col-span-2 lg:col-span-3">
            {client.billingEmails.join(', ')}
          </Fact>
          <Fact label="Terms accepted">
            {client.termsAcceptedAt ? `v${client.termsVersion} · ${fmtDate(client.termsAcceptedAt)}` : 'Not yet'}
          </Fact>
          <Fact label="Client since">{fmtDate(client.createdAt)}</Fact>
        </div>
        {client.notes && (
          <p className="rounded-inner bg-canvas text-ink-700 mt-5 p-3 text-sm whitespace-pre-line">{client.notes}</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Logo" subtitle="Shown in the client's app and on its reports" />
        <div className="flex items-center gap-4">
          <Avatar name={client.displayName} src={client.logoUrl} size={64} />
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            hidden
            onChange={(e) => void logo(e.target.files?.[0])}
          />
          <Button variant="secondary" loading={busy === 'logo'} onClick={() => file.current?.click()}>
            <Upload /> Upload
          </Button>
        </div>
      </Card>
      <Drawer open={edit} onOpenChange={setEdit} title="Edit client" width="lg">
        <ClientForm client={client} onDone={() => setEdit(false)} />
      </Drawer>
    </div>
  );
}

// ---------------------------------------------------------------- plants

function PlantsTab({ client }: { client: AdminClient }) {
  const router = useRouter();
  const q = useAList<AdminPlant>('/plants', { clientId: client.id, page: 1, pageSize: 100, sort: 'name' });
  return (
    <Card>
      <CardHeader
        title="Plants"
        action={
          <Button size="sm" asChild>
            <Link href={`/admin/plants/new?clientId=${client.id}`}>
              <Plus /> Add plant
            </Link>
          </Button>
        }
      />
      <DataTable
        loading={q.isLoading}
        rows={q.data?.items}
        rowKey={(p) => p.id}
        onRowClick={(p) => router.push(`/admin/plants/${p.id}`)}
        empty="No plants yet — add the first one with the wizard."
        columns={[
          {
            key: 'n',
            header: 'Plant',
            cell: (p) => <NameCell name={p.name} sub={`${p.code} · ${p.type} · ${fmtNum(p.capacityMld)} MLD`} />,
          },
          {
            key: 'om',
            header: 'O&M period',
            hideBelow: 'md',
            cell: (p) => (
              <span className="text-ink-500 text-xs">
                {fmtDate(p.omStart)} – {fmtDate(p.omEnd)}
              </span>
            ),
          },
          { key: 'plan', header: 'Plan', hideBelow: 'lg', cell: (p) => p.planName ?? '—' },
          { key: 's', header: 'Setup', cell: (p) => <StatusBadge status={p.setupStatus} size="sm" /> },
          { key: 'a', header: 'Account', cell: (p) => <StatusBadge status={p.accountState} size="sm" /> },
        ]}
      />
    </Card>
  );
}

// ---------------------------------------------------------------- users

function UsersTab({ client }: { client: AdminClient }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'active' | 'invited' | 'disabled'>('all');
  const q = useAList<ClientUser>(`/clients/${client.id}/users`, {
    page,
    pageSize: 20,
    status: status === 'all' ? undefined : status,
  });
  const [invite, setInvite] = useState(false);
  const { run } = useRun();
  const base = `/clients/${client.id}/users`;
  const act = (u: ClientUser, a: string, msg: string) =>
    run(a, () => adminApi.post(`${base}/${u.id}/${a}`), msg).catch(toastError);
  return (
    <Card>
      <CardHeader
        title="Users"
        subtitle="Client Admins manage roles in their own app; here you can invite, reset and switch access."
        action={
          <div className="flex items-center gap-2">
            <Segmented
              size="sm"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              items={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'invited', label: 'Invited' },
                { value: 'disabled', label: 'Disabled' },
              ]}
            />
            <Button size="sm" onClick={() => setInvite(true)}>
              <UserPlus /> Invite
            </Button>
          </div>
        }
      />
      <DataTable
        loading={q.isLoading}
        rows={q.data?.items}
        rowKey={(u) => u.id}
        empty="No users."
        columns={[
          {
            key: 'n',
            header: 'User',
            cell: (u) => (
              <div className="flex items-center gap-3">
                <Avatar name={u.name} size={32} />
                <NameCell name={u.name} sub={u.email} />
              </div>
            ),
          },
          {
            key: 'r',
            header: 'Access',
            hideBelow: 'md',
            cell: (u) => (
              <div className="flex flex-wrap gap-1">
                {u.isClientAdmin && (
                  <Badge size="sm" tone="purple">
                    Client Admin
                  </Badge>
                )}
                {u.plantRoles.slice(0, 3).map((r) => (
                  <Badge key={r.plantId} size="sm" tone="neutral">
                    {r.plantName}: {labelize(r.role)}
                  </Badge>
                ))}
                {u.plantRoles.length > 3 && <Badge size="sm">+{u.plantRoles.length - 3}</Badge>}
              </div>
            ),
          },
          {
            key: '2fa',
            header: '2FA',
            hideBelow: 'lg',
            cell: (u) =>
              u.totpEnabled ? (
                <ShieldCheck className="text-success-600 size-4" />
              ) : (
                <span className="text-ink-300">—</span>
              ),
          },
          {
            key: 'l',
            header: 'Last sign-in',
            hideBelow: 'lg',
            cell: (u) => <span className="text-ink-500 text-xs">{fmtRelative(u.lastLoginAt)}</span>,
          },
          { key: 's', header: 'Status', cell: (u) => <StatusBadge status={u.status} size="sm" /> },
          {
            key: 'x',
            header: '',
            align: 'right',
            cell: (u) => (
              <CardMenu
                items={[
                  {
                    label: u.isClientAdmin ? 'Remove Client Admin' : 'Make Client Admin',
                    icon: <ShieldCheck className="size-4" />,
                    onSelect: () =>
                      void run(
                        'ca',
                        () => adminApi.patch(`${base}/${u.id}`, { isClientAdmin: !u.isClientAdmin }),
                        'Saved',
                      ).catch(toastError),
                  },
                  {
                    label: 'Resend invitation',
                    icon: <Send className="size-4" />,
                    disabled: u.status !== 'invited',
                    onSelect: () => void act(u, 'resend-invite', 'Invitation sent'),
                  },
                  {
                    label: 'Send password reset',
                    icon: <KeyRound className="size-4" />,
                    disabled: u.status !== 'active',
                    onSelect: () => void act(u, 'reset-password', 'Reset e-mail sent'),
                  },
                  u.status === 'disabled'
                    ? {
                        label: 'Enable',
                        icon: <Play className="size-4" />,
                        onSelect: () => void act(u, 'enable', 'User enabled'),
                      }
                    : {
                        label: 'Disable',
                        icon: <Power className="size-4" />,
                        danger: true,
                        onSelect: () => void act(u, 'disable', 'User disabled'),
                      },
                ]}
              />
            ),
          },
        ]}
      />
      {q.data && <Pagination page={page} pageSize={20} total={q.data.meta.total} onPageChange={setPage} />}
      <InviteDrawer client={client} open={invite} onClose={() => setInvite(false)} />
    </Card>
  );
}

function InviteDrawer({ client, open, onClose }: { client: AdminClient; open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: '', email: '', mobile: '', designation: '', isClientAdmin: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  async function save() {
    const v = check(userInviteBody, {
      name: f.name.trim(),
      email: f.email.trim(),
      ...(f.mobile.trim() ? { mobile: f.mobile.trim() } : {}),
      ...(f.designation.trim() ? { designation: f.designation.trim() } : {}),
      isClientAdmin: f.isClientAdmin,
    });
    if (!v.ok) return setErrors(v.errors);
    try {
      await run('invite', () => adminApi.post(`/clients/${client.id}/users`, v.data), 'Invitation sent');
      setF({ name: '', email: '', mobile: '', designation: '', isClientAdmin: false });
      setErrors({});
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Invite a user"
      description={`${client.displayName} — plant roles are given by the Client Admin`}
      footer={
        <Button block onClick={save} loading={busy === 'invite'}>
          <MailPlus /> Send invitation
        </Button>
      }
    >
      <div className="space-y-4">
        {(['name', 'email', 'mobile', 'designation'] as const).map((k) => (
          <Field key={k} label={labelize(k)} required={k === 'name' || k === 'email'} error={errors[k]}>
            <Input
              type={k === 'email' ? 'email' : 'text'}
              value={f[k]}
              onChange={(e) => setF((s) => ({ ...s, [k]: e.target.value }))}
              invalid={!!errors[k]}
            />
          </Field>
        ))}
        <label className="rounded-inner border-line flex items-center justify-between border p-3">
          <span className="text-ink-900 text-sm font-medium">Client Admin</span>
          <Switch
            checked={f.isClientAdmin}
            onCheckedChange={(v) => setF((s) => ({ ...s, isClientAdmin: v }))}
            aria-label="Client Admin"
          />
        </label>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------- billing & credit

interface Credit {
  balance: string;
  ledger: Array<{ id: string; date: string; kind: string; amount: string; refType: string | null; createdAt: string }>;
}
function BillingTab({ client }: { client: AdminClient }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const inv = useAList<AdminInvoice>('/invoices', { clientId: client.id, page, pageSize: 20 });
  const credit = useA<Credit>(`/clients/${client.id}/credit`);
  const [dlg, setDlg] = useState<'refund' | 'apply' | null>(null);
  const bal = Number(credit.data?.balance ?? 0);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader
          title="Invoices"
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/admin/invoices/new?clientId=${client.id}`}>
                <Plus /> Manual invoice
              </Link>
            </Button>
          }
        />
        <DataTable
          loading={inv.isLoading}
          rows={inv.data?.items}
          rowKey={(i) => i.id}
          onRowClick={(i) => router.push(`/admin/invoices/${i.id}`)}
          empty="No invoices yet."
          columns={[
            {
              key: 'n',
              header: 'Invoice',
              cell: (i) => <NameCell name={i.number ?? 'Draft'} sub={i.plants ?? labelize(i.kind)} />,
            },
            {
              key: 'd',
              header: 'Date',
              hideBelow: 'md',
              cell: (i) => <span className="text-xs">{fmtDate(i.issueDate)}</span>,
            },
            { key: 't', header: 'Total', align: 'right', cell: (i) => <MoneyCell v={i.total} strong /> },
            {
              key: 'b',
              header: 'Balance',
              align: 'right',
              cell: (i) => <MoneyCell v={i.balance} tone={Number(i.balance) > 0 ? 'danger' : undefined} />,
            },
            { key: 's', header: 'Status', cell: (i) => <StatusBadge status={i.status} size="sm" /> },
          ]}
        />
        {inv.data && <Pagination page={page} pageSize={20} total={inv.data.meta.total} onPageChange={setPage} />}
      </Card>
      <Card>
        <CardHeader icon={<Wallet />} title="Credit balance" subtitle="Advance and excess payments" />
        <p className="text-ink-900 tabular text-3xl font-semibold">
          {credit.data ? fmtMoney(credit.data.balance) : '…'}
        </p>
        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" disabled={bal <= 0} onClick={() => setDlg('apply')}>
            Apply to invoice
          </Button>
          <Button size="sm" variant="secondary" disabled={bal <= 0} onClick={() => setDlg('refund')}>
            <RotateCcw /> Refund
          </Button>
        </div>
        <ul className="divide-line mt-5 divide-y">
          {(credit.data?.ledger ?? []).slice(0, 12).map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="text-ink-900 font-medium">{labelize(l.kind)}</span>
                <span className="text-ink-400 block text-xs">{fmtDate(l.date)}</span>
              </span>
              <MoneyCell v={l.amount} tone={Number(l.amount) < 0 ? 'danger' : 'success'} />
            </li>
          ))}
        </ul>
      </Card>
      {dlg === 'refund' && <RefundDialog client={client} onClose={() => setDlg(null)} />}
      {dlg === 'apply' && (
        <ApplyCreditDialog
          client={client}
          invoices={(inv.data?.items ?? []).filter((i) => Number(i.balance) > 0 && i.status !== 'draft')}
          onClose={() => setDlg(null)}
        />
      )}
    </div>
  );
}

function RefundDialog({ client, onClose }: { client: AdminClient; onClose: () => void }) {
  const [f, setF] = useState({
    amount: '',
    refundDate: todayIST() as string | null,
    mode: 'neft',
    reference: '',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  async function go() {
    const v = check(refundBody, { ...f, reference: f.reference.trim() || undefined, reason: f.reason.trim() });
    if (!v.ok) return setErrors(v.errors);
    try {
      await run('refund', () => adminApi.post(`/clients/${client.id}/credit/refund`, v.data), 'Refund recorded');
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Refund credit"
      description="Records money paid back to the client (no receipt is created)."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy === 'refund'}>
            Record refund
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)" required error={errors.amount}>
          <Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Refund date" required error={errors.refundDate}>
          <DateField value={f.refundDate} onChange={(d) => setF({ ...f, refundDate: d })} />
        </Field>
        <Field label="Mode" required>
          <Select
            value={f.mode}
            onValueChange={(v) => setF({ ...f, mode: v })}
            options={enumOptions(OFFLINE_PAYMENT_MODES)}
          />
        </Field>
        <Field label="Reference" error={errors.reference}>
          <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
        </Field>
        <Field label="Reason" required className="sm:col-span-2" error={errors.reason}>
          <Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function ApplyCreditDialog({
  client,
  invoices,
  onClose,
}: {
  client: AdminClient;
  invoices: AdminInvoice[];
  onClose: () => void;
}) {
  const [invoiceId, setInvoiceId] = useState<string | undefined>(invoices[0]?.id);
  const [amount, setAmount] = useState('');
  const { run, busy } = useRun();
  async function go() {
    if (!invoiceId) return;
    await run(
      'apply',
      () =>
        adminApi.post(`/clients/${client.id}/credit/apply`, {
          invoiceId,
          ...(amount.trim() ? { amount: amount.trim() } : {}),
        }),
      'Credit applied',
    )
      .then(onClose)
      .catch(toastError);
  }
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Apply credit"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy === 'apply'} disabled={!invoiceId}>
            Apply
          </Button>
        </>
      }
    >
      {invoices.length === 0 ? (
        <EmptyState compact title="No open invoices on this page" />
      ) : (
        <div className="space-y-4">
          <Field label="Invoice" required>
            <Select
              value={invoiceId}
              onValueChange={setInvoiceId}
              options={invoices.map((i) => ({
                value: i.id,
                label: i.number ?? 'Draft',
                hint: `due ${fmtMoney(i.balance)}`,
              }))}
            />
          </Field>
          <Field label="Amount (₹)" hint="Empty = as much as possible">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- documents

function DocumentsTab({ client }: { client: AdminClient }) {
  const docs = useA<ClientDocument[]>(`/clients/${client.id}/documents`);
  const [up, setUp] = useState(false);
  const [del, setDel] = useState<ClientDocument | null>(null);
  const { run } = useRun();
  return (
    <Card>
      <CardHeader
        title="Documents"
        subtitle="Agreements, purchase and work orders (PDF or image, private to Super Admins)"
        action={
          <Button size="sm" onClick={() => setUp(true)}>
            <FileUp /> Upload
          </Button>
        }
      />
      <DataTable
        loading={docs.isLoading}
        rows={docs.data}
        rowKey={(d) => d.id}
        empty="No documents yet."
        columns={[
          { key: 't', header: 'Title', cell: (d) => <NameCell name={d.title} sub={d.remarks} /> },
          { key: 'k', header: 'Type', cell: (d) => <Badge size="sm">{labelize(d.docType)}</Badge> },
          {
            key: 'd',
            header: 'Date',
            hideBelow: 'md',
            cell: (d) => <span className="text-xs">{fmtDate(d.docDate)}</span>,
          },
          {
            key: 'u',
            header: 'Uploaded',
            hideBelow: 'lg',
            cell: (d) => <span className="text-ink-500 text-xs">{fmtDateTime(d.createdAt)}</span>,
          },
          {
            key: 'x',
            header: '',
            align: 'right',
            cell: (d) => (
              <div className="flex justify-end gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Download"
                  onClick={() => void adminDownload(`/clients/${client.id}/documents/${d.id}/download`)}
                >
                  <Download />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Delete" onClick={() => setDel(d)}>
                  <Trash2 />
                </Button>
              </div>
            ),
          },
        ]}
      />
      {up && <UploadDocDialog client={client} onClose={() => setUp(false)} />}
      {del && (
        <ReasonDialog
          open
          noReason
          tone="danger"
          title="Delete document?"
          description={del.title}
          confirm="Delete"
          onClose={() => setDel(null)}
          onConfirm={() =>
            run('del', () => adminApi.del(`/clients/${client.id}/documents/${del.id}`), 'Document deleted')
          }
        />
      )}
    </Card>
  );
}

function UploadDocDialog({ client, onClose }: { client: AdminClient; onClose: () => void }) {
  const [f, setF] = useState({ docType: 'agreement', title: '', docDate: null as string | null, remarks: '' });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  async function go() {
    if (f.title.trim().length < 2) return setErrors({ title: 'Enter a title' });
    if (!file) return setErrors({ file: 'Choose a PDF or image' });
    const form = new FormData();
    form.append('docType', f.docType);
    form.append('title', f.title.trim());
    if (f.docDate) form.append('docDate', f.docDate);
    if (f.remarks.trim()) form.append('remarks', f.remarks.trim());
    form.append('file', file);
    try {
      await run('up', () => adminApi.upload(`/clients/${client.id}/documents`, form), 'Document uploaded');
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Upload document"
      icon={<FileUp />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy === 'up'}>
            Upload
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required>
          <Select
            value={f.docType}
            onValueChange={(v) => setF({ ...f, docType: v })}
            options={enumOptions(DOCUMENT_TYPES)}
          />
        </Field>
        <Field label="Document date">
          <DateField value={f.docDate} onChange={(d) => setF({ ...f, docDate: d })} clearable />
        </Field>
        <Field label="Title" required className="sm:col-span-2" error={errors.title}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <Field label="Remarks" className="sm:col-span-2">
          <Input value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
        </Field>
        <Field label="File" required className="sm:col-span-2" error={errors.file}>
          <Input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- lifecycle history, usage

function HistoryTab({ client }: { client: AdminClient }) {
  const h = useA<LifecycleEvent[]>(`/clients/${client.id}/lifecycle`);
  return (
    <Card>
      <CardHeader title="Account state history" subtitle="Automatic and manual changes for the client and its plants" />
      <DataTable
        loading={h.isLoading}
        rows={h.data}
        rowKey={(e) => e.id}
        empty="No changes yet."
        columns={[
          {
            key: 'at',
            header: 'When',
            cell: (e) => <span className="text-xs whitespace-nowrap">{fmtDateTime(e.at)}</span>,
          },
          { key: 'p', header: 'Scope', cell: (e) => e.plantName ?? 'Whole client' },
          {
            key: 'c',
            header: 'Change',
            cell: (e) => (
              <span className="flex items-center gap-1.5">
                <StatusBadge status={e.from} size="sm" /> → <StatusBadge status={e.to} size="sm" />
              </span>
            ),
          },
          {
            key: 'w',
            header: 'Cause',
            hideBelow: 'md',
            cell: (e) => <NameCell name={labelize(e.cause)} sub={e.note} />,
          },
          {
            key: 'by',
            header: 'By',
            hideBelow: 'lg',
            cell: (e) => <span className="text-ink-500 text-xs">{labelize(e.actorType)}</span>,
          },
        ]}
      />
    </Card>
  );
}

function UsageTab({ client }: { client: AdminClient }) {
  const u = useA<UsageRow[]>(`/clients/${client.id}/usage`);
  return (
    <Card>
      <CardHeader title="Usage by plant" subtitle="Users, storage and logsheet activity (refreshed nightly)" />
      <UsageTable rows={u.data} loading={u.isLoading} showClient={false} />
    </Card>
  );
}

// ---------------------------------------------------------------- support access (act-as)

function SupportTab({ client }: { client: AdminClient }) {
  const s = useA<ActAsSession[]>(`/clients/${client.id}/act-as`);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  async function start() {
    const v = check(actAsBody, { mode, ...(reason.trim() ? { reason: reason.trim() } : {}) });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    const tab = window.open('about:blank', '_blank');
    try {
      const r = await run(
        'start',
        () => adminApi.post<{ code: string; url: string }>(`/clients/${client.id}/act-as`, v.data),
        'Support session started',
      );
      if (r) {
        const url = `/act-as?code=${encodeURIComponent(r.code)}`;
        if (tab) tab.location.href = url;
        else window.open(url, '_blank');
      }
    } catch (e) {
      tab?.close();
      setErrors(errorsOf(e));
    }
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Card>
        <CardHeader
          icon={<Eye />}
          title="Open the client's app"
          subtitle="A new tab signs in as this client; every action is audited with your name."
        />
        <div className="space-y-4">
          <Segmented
            block
            value={mode}
            onChange={setMode}
            items={[
              { value: 'view', label: 'View only' },
              { value: 'edit', label: 'Can edit' },
            ]}
          />
          <Field
            label="Reason"
            required={mode === 'edit'}
            hint={mode === 'edit' ? 'At least 10 characters — the client may be e-mailed.' : 'Optional for view-only.'}
            error={errors.reason}
          >
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Button block onClick={start} loading={busy === 'start'} disabled={client.accountState === 'terminated'}>
            <Eye /> Start session
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Sessions" />
        <DataTable
          loading={s.isLoading}
          rows={s.data}
          rowKey={(x) => x.id}
          empty="No support sessions yet."
          columns={[
            {
              key: 'w',
              header: 'Started',
              cell: (x) => <span className="text-xs whitespace-nowrap">{fmtDateTime(x.startedAt)}</span>,
            },
            { key: 'b', header: 'By', cell: (x) => x.superAdminName ?? '—' },
            {
              key: 'm',
              header: 'Mode',
              cell: (x) => (
                <Badge size="sm" tone={x.mode === 'edit' ? 'warning' : 'brand'}>
                  {x.mode === 'edit' ? 'Edit' : 'View'}
                </Badge>
              ),
            },
            {
              key: 'r',
              header: 'Reason',
              hideBelow: 'md',
              cell: (x) => <span className="text-ink-500 text-xs">{x.reason ?? '—'}</span>,
            },
            {
              key: 'e',
              header: '',
              align: 'right',
              cell: (x) =>
                x.endedAt ? (
                  <span className="text-ink-400 text-xs">Ended {fmtRelative(x.endedAt)}</span>
                ) : (
                  <Button
                    size="sm"
                    variant="danger-soft"
                    onClick={() =>
                      void run('end', () => adminApi.post(`/act-as/${x.id}/end`), 'Session ended').catch(toastError)
                    }
                  >
                    End now
                  </Button>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- data export & deletion

interface AdminExport {
  id: string;
  status: 'queued' | 'building' | 'ready' | 'failed' | 'expired';
  scope: { type?: string; plantIds?: string[] | null };
  createdAt: string;
  error?: string | null;
}
function DataTab({ client }: { client: AdminClient }) {
  const ex = useA<AdminExport[]>(`/clients/${client.id}/exports`, undefined, { refetchInterval: 5000 });
  const [del, setDel] = useState(false);
  const [code, setCode] = useState('');
  const router = useRouter();
  const { run, busy } = useRun();
  const canDelete = client.status === 'scheduled_for_deletion' || client.accountState === 'terminated';
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader
          icon={<Archive />}
          title="Full data export"
          subtitle="Every logsheet, setting, user, invoice and PDF as one ZIP (available 7 days)"
          action={
            <Button
              size="sm"
              loading={busy === 'export'}
              onClick={() =>
                void run('export', () => adminApi.post(`/clients/${client.id}/export`, {}), 'Export started').catch(
                  toastError,
                )
              }
            >
              <Archive /> Start export
            </Button>
          }
        />
        <DataTable
          rows={ex.data}
          loading={ex.isLoading}
          rowKey={(e) => e.id}
          dense
          empty="No exports yet."
          columns={[
            { key: 'c', header: 'Requested', cell: (e) => <span className="text-xs">{fmtDateTime(e.createdAt)}</span> },
            {
              key: 's',
              header: 'Status',
              cell: (e) => (
                <StatusBadge
                  status={
                    e.status === 'ready'
                      ? 'done'
                      : e.status === 'building' || e.status === 'queued'
                        ? 'running'
                        : e.status
                  }
                  size="sm"
                />
              ),
            },
            {
              key: 'd',
              header: '',
              align: 'right',
              cell: (e) =>
                e.status === 'ready' ? (
                  <Button
                    size="sm"
                    variant="soft"
                    onClick={() => void adminDownload(`/clients/${client.id}/exports/${e.id}/download`)}
                  >
                    <Download /> Download
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
      <Card className="border-danger-100">
        <CardHeader
          icon={<Trash2 />}
          title="Delete all data"
          subtitle="Permanent. Only after termination; take an export first."
        />
        <p className="text-ink-500 text-sm">
          Type the client code <b className="text-ink-900">{client.code}</b> to confirm. Invoices are kept as required
          by GST law; everything else is erased.
        </p>
        <Button className="mt-4" variant="danger" disabled={!canDelete} onClick={() => setDel(true)}>
          <Trash2 /> Delete client data
        </Button>
      </Card>
      {del && (
        <ReasonDialog
          open
          tone="danger"
          title={`Delete ${client.displayName}?`}
          description="This cannot be undone."
          confirm="Delete permanently"
          onClose={() => setDel(false)}
          onConfirm={async ({ reason }) => {
            await run(
              'delete',
              () => adminApi.post(`/clients/${client.id}/delete`, { confirmCode: code.trim(), reason }),
              'Deletion queued',
            );
            router.push('/admin/clients');
          }}
        >
          <Field label="Client code" required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={client.code} />
          </Field>
        </ReasonDialog>
      )}
    </div>
  );
}
