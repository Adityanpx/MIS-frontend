'use client';

import {
  BadgeIndianRupee,
  Building2,
  CreditCard,
  Eye,
  Hash,
  KeyRound,
  Layers,
  LifeBuoy,
  Mail,
  MailPlus,
  Palette,
  Play,
  Power,
  Receipt,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Timer,
  UserPlus,
  Users,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardMenu } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Avatar, Skeleton, Switch } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/ui/table';
import { Segmented } from '@/components/ui/tabs';
import { useAdminAuth } from '@/lib/auth/admin-auth';
import { fmtDateTime, fmtNum, fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SettingsGroup } from '@/shared/enums';
import { superAdminCreateBody } from '@/shared/schemas/admin';
import { adminApi, check, errorsOf, labelize, NameCell, STATE_OPTIONS, toastError, useA, useRun } from './kit';
import type { SuperAdmin } from './types';

// ---------------------------------------------------------------- field specs (mirror the API's strict schemas)

type Kind = 'text' | 'number' | 'bool' | 'list' | 'numlist' | 'select' | 'secret' | 'textarea' | 'state';
interface Spec {
  path: string;
  label: string;
  kind?: Kind;
  hint?: string;
  optional?: boolean;
  options?: Array<{ value: string; label: string }>;
  wide?: boolean;
}
interface GroupDef {
  group: SettingsGroup;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  fields: Spec[];
  logo?: boolean;
}
const GROUPS: GroupDef[] = [
  {
    group: 'company',
    title: 'Your company',
    subtitle: 'Seller details printed on invoices, receipts and credit notes',
    icon: Building2,
    logo: true,
    fields: [
      { path: 'legalName', label: 'Legal name' },
      { path: 'tradeName', label: 'Trade name' },
      { path: 'address.line1', label: 'Address line 1' },
      { path: 'address.line2', label: 'Address line 2', optional: true },
      { path: 'address.city', label: 'City' },
      { path: 'address.pin', label: 'PIN code' },
      { path: 'stateCode', label: 'State', kind: 'state' },
      { path: 'gstin', label: 'GSTIN' },
      { path: 'pan', label: 'PAN' },
      { path: 'cin', label: 'CIN' },
      { path: 'email', label: 'E-mail' },
      { path: 'phone', label: 'Phone' },
      { path: 'bank.accountName', label: 'Bank account name' },
      { path: 'bank.accountNo', label: 'Account number' },
      { path: 'bank.ifsc', label: 'IFSC' },
      { path: 'bank.branch', label: 'Branch' },
      { path: 'upiId', label: 'UPI ID' },
      { path: 'signatory.name', label: 'Signatory name' },
      { path: 'signatory.designation', label: 'Signatory designation' },
      { path: 'footerTerms', label: 'Footer terms', kind: 'textarea', wide: true },
    ],
  },
  {
    group: 'tax',
    title: 'Tax',
    subtitle: 'GST rate, SAC and TDS sections',
    icon: BadgeIndianRupee,
    fields: [
      { path: 'gstRatePct', label: 'GST rate %', kind: 'number' },
      { path: 'sac', label: 'SAC code', hint: '6 digits' },
      { path: 'tdsSections', label: 'TDS sections', kind: 'list', hint: 'Comma separated, e.g. 194J, 194C' },
      { path: 'closeTolerance', label: 'Close tolerance (₹)', hint: 'Balances up to this amount count as paid' },
    ],
  },
  {
    group: 'numbering',
    title: 'Numbering',
    subtitle: 'Prefixes — numbers restart every financial year',
    icon: Hash,
    fields: [
      { path: 'invoicePrefix', label: 'Invoice prefix', hint: '1–8 capital letters' },
      { path: 'creditNotePrefix', label: 'Credit note prefix' },
      { path: 'receiptPrefix', label: 'Receipt prefix' },
    ],
  },
  {
    group: 'billing',
    title: 'Billing',
    subtitle: 'When invoices are raised and how Razorpay fees are handled',
    icon: Receipt,
    fields: [
      { path: 'invoiceLeadDays', label: 'Invoice days before the year starts', kind: 'number' },
      { path: 'minPaymentTermsDays', label: 'Payment terms (days)', kind: 'number' },
      { path: 'autoIssue', label: 'Issue planned invoices automatically', kind: 'bool' },
      { path: 'autoApplyCredit', label: 'Apply client credit to new invoices', kind: 'bool' },
      {
        path: 'gatewayFeeMode',
        label: 'Gateway fee',
        kind: 'select',
        options: [
          { value: 'absorb', label: 'We absorb it' },
          { value: 'convenience', label: 'Client pays a convenience fee' },
        ],
      },
      { path: 'gatewayFeePct', label: 'Gateway fee %', kind: 'number' },
      { path: 'linkExpiryDaysAfterDue', label: 'Payment link expires (days after due)', kind: 'number' },
    ],
  },
  {
    group: 'lifecycle',
    title: 'Account lifecycle',
    subtitle: 'Grace → read-only → suspended → terminated after an unpaid due date',
    icon: Timer,
    fields: [
      { path: 'graceDays', label: 'Grace days', kind: 'number' },
      { path: 'readOnlyDays', label: 'Read-only days', kind: 'number' },
      { path: 'suspendedDays', label: 'Suspended days', kind: 'number' },
      { path: 'retentionDays', label: 'Data kept after termination (days)', kind: 'number' },
      { path: 'chequePauseMaxDays', label: 'Max pause for a pending cheque (days)', kind: 'number' },
      { path: 'renewalWindowDays', label: 'Renewal window (days)', kind: 'number' },
      { path: 'expiringAlertDays', label: 'Expiry alert (days before)', kind: 'number' },
    ],
  },
  {
    group: 'reminders',
    title: 'Reminders',
    subtitle: 'Days on which reminder e-mails go out',
    icon: Mail,
    fields: [
      { path: 'preDueDays', label: 'Before due date', kind: 'numlist', hint: 'e.g. 7, 3, 1' },
      { path: 'overdueDays', label: 'After due date', kind: 'numlist', hint: 'e.g. 1, 7, 15, 30' },
      { path: 'renewalDays', label: 'Before subscription end', kind: 'numlist', hint: 'e.g. 90, 60, 30' },
    ],
  },
  {
    group: 'plans',
    title: 'Plan terms',
    subtitle: 'Terms (years) a plan can have',
    icon: Layers,
    fields: [{ path: 'allowedTerms', label: 'Allowed terms', kind: 'numlist', hint: 'e.g. 5, 10, 15' }],
  },
  {
    group: 'payment-gateway',
    title: 'Razorpay',
    subtitle: 'Keys are stored encrypted and never shown again',
    icon: CreditCard,
    fields: [
      {
        path: 'mode',
        label: 'Mode',
        kind: 'select',
        options: [
          { value: 'test', label: 'Test' },
          { value: 'live', label: 'Live' },
        ],
      },
      { path: 'keyId', label: 'Key ID', hint: 'rzp_test_… or rzp_live_…' },
      { path: 'keySecret', label: 'Key secret', kind: 'secret' },
      { path: 'webhookSecret', label: 'Webhook secret', kind: 'secret' },
    ],
  },
  {
    group: 'email',
    title: 'E-mail',
    subtitle: 'Sender shown on every e-mail',
    icon: MailPlus,
    fields: [
      { path: 'senderName', label: 'Sender name' },
      { path: 'replyTo', label: 'Reply-to address' },
    ],
  },
  {
    group: 'branding',
    title: 'Branding & terms',
    subtitle: 'Platform name, support contact and the terms clients accept',
    icon: Palette,
    logo: true,
    fields: [
      { path: 'name', label: 'Platform name' },
      { path: 'supportEmail', label: 'Support e-mail' },
      { path: 'supportPhone', label: 'Support phone' },
      { path: 'termsVersion', label: 'Terms version', hint: 'A new version asks every user to accept again' },
      { path: 'termsUrl', label: 'Terms URL' },
      { path: 'privacyUrl', label: 'Privacy URL' },
    ],
  },
  {
    group: 'security',
    title: 'Security',
    subtitle: 'Automatic sign-out after inactivity',
    icon: ShieldCheck,
    fields: [
      { path: 'clientIdleMinutes', label: 'Client app (minutes)', kind: 'number' },
      { path: 'adminIdleMinutes', label: 'Super Admin panel (minutes)', kind: 'number' },
    ],
  },
  {
    group: 'act-as',
    title: 'Support access',
    subtitle: 'Act-as sessions',
    icon: LifeBuoy,
    fields: [
      { path: 'emailClientOnEdit', label: 'E-mail the Client Admins when an edit session starts', kind: 'bool' },
    ],
  },
];

const getPath = (o: unknown, path: string): unknown =>
  path
    .split('.')
    .reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), o);
function setPath(o: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let cur = o;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = (cur[k] as Record<string, unknown> | undefined) ?? {};
    cur = cur[k] as Record<string, unknown>;
  });
  cur[keys[keys.length - 1]!] = value;
}
const toForm = (spec: Spec, v: unknown): string | boolean => {
  if (spec.kind === 'bool') return !!v;
  if (spec.kind === 'secret') return '';
  if (Array.isArray(v)) return v.join(', ');
  return v === undefined || v === null ? '' : String(v);
};
const fromForm = (spec: Spec, v: string | boolean): unknown => {
  if (spec.kind === 'bool') return v;
  const s = String(v).trim();
  if (spec.kind === 'list')
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  if (spec.kind === 'numlist')
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
      .map(Number);
  if (spec.kind === 'number') return s === '' ? undefined : Number(s);
  return s;
};

// ---------------------------------------------------------------- page

type Section = SettingsGroup | 'super-admins' | 'email-templates';
/** /admin/settings — platform settings (SST-01…12), Super Admins (SA-01…04), e-mail templates (SST-09). */
export function AdminSettingsView({ section }: { section?: string }) {
  const router = useRouter();
  const current = (section ?? 'company') as Section;
  const nav: Array<{ value: Section; label: string; icon: LucideIcon }> = [
    ...GROUPS.map((g) => ({ value: g.group as Section, label: g.title, icon: g.icon })),
    { value: 'super-admins', label: 'Super Admins', icon: Users },
    { value: 'email-templates', label: 'E-mail templates', icon: Mail },
  ];
  const def = GROUPS.find((g) => g.group === current);
  return (
    <>
      <PageHeader title="Settings" subtitle="Platform-wide settings — every change is in the audit log" />
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card padded={false} className="p-2 lg:sticky lg:top-[96px]">
          <nav className="scrollbar-none flex gap-1 overflow-x-auto lg:flex-col">
            {nav.map((n) => (
              <button
                key={n.value}
                type="button"
                onClick={() => router.push(`/admin/settings/${n.value}`)}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                  n.value === current ? 'bg-brand-50 text-brand-500 font-semibold' : 'text-ink-700 hover:bg-canvas',
                )}
              >
                <n.icon className="size-4" /> {n.label}
              </button>
            ))}
          </nav>
        </Card>
        <div className="min-w-0">
          {def ? (
            <GroupForm key={def.group} def={def} />
          ) : current === 'super-admins' ? (
            <SuperAdmins />
          ) : (
            <EmailTemplates />
          )}
        </div>
      </div>
    </>
  );
}

function GroupForm({ def }: { def: GroupDef }) {
  const q = useA<Record<string, unknown>>(`/settings/${def.group}`);
  const [f, setF] = useState<Record<string, string | boolean> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (q.data && !f) setF(Object.fromEntries(def.fields.map((s) => [s.path, toForm(s, getPath(q.data, s.path))])));
  }, [q.data, f, def.fields]);

  async function save() {
    if (!f) return;
    const body: Record<string, unknown> = {};
    for (const s of def.fields) {
      const v = fromForm(s, f[s.path] ?? '');
      if ((s.optional || s.kind === 'secret') && v === '') continue;
      if (v === undefined) continue;
      setPath(body, s.path, v);
    }
    try {
      await run('save', () => adminApi.put(`/settings/${def.group}`, body), `${def.title} saved`);
      setErrors({});
      setF(null); // reload from the server (secrets cleared)
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  async function logo(fl: File | undefined) {
    if (!fl) return;
    const form = new FormData();
    form.append('file', fl);
    await run('logo', () => adminApi.upload(`/settings/${def.group}/logo`, form), 'Logo updated').catch(toastError);
  }
  async function testGateway() {
    const r = await run('test', () =>
      adminApi.post<{ ok: boolean; message: string }>('/settings/payment-gateway/test'),
    ).catch(toastError);
    if (r) (r.ok ? toast.success : toast.error)(r.message);
  }
  const data = q.data ?? {};
  return (
    <Card>
      <CardHeader icon={<def.icon />} title={def.title} subtitle={def.subtitle} />
      {!f ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <>
          {def.logo && (
            <div className="rounded-inner border-line mb-6 flex items-center gap-4 border p-3">
              <Avatar name={def.title} src={(data.logoUrl as string | null) ?? null} size={56} />
              <input
                ref={file}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => void logo(e.target.files?.[0])}
              />
              <Button size="sm" variant="secondary" loading={busy === 'logo'} onClick={() => file.current?.click()}>
                Upload logo
              </Button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {def.fields.map((s) => {
              const err = errors[s.path];
              const v = f[s.path];
              const set = (nv: string | boolean) => setF({ ...f, [s.path]: nv });
              if (s.kind === 'bool')
                return (
                  <label
                    key={s.path}
                    className="rounded-inner border-line flex items-center justify-between gap-3 border p-3 sm:col-span-2"
                  >
                    <span className="text-ink-900 text-sm font-medium">{s.label}</span>
                    <Switch checked={!!v} onCheckedChange={set} aria-label={s.label} />
                  </label>
                );
              const secretSet = s.kind === 'secret' && !!data[`${s.path}Set`];
              return (
                <Field
                  key={s.path}
                  label={s.label}
                  hint={secretSet ? 'Saved — leave empty to keep it' : s.hint}
                  error={err}
                  className={s.wide ? 'sm:col-span-2' : undefined}
                >
                  {s.kind === 'select' || s.kind === 'state' ? (
                    <Select
                      value={String(v) || undefined}
                      onValueChange={set}
                      options={s.kind === 'state' ? STATE_OPTIONS : (s.options ?? [])}
                    />
                  ) : s.kind === 'textarea' ? (
                    <Textarea rows={3} value={String(v)} onChange={(e) => set(e.target.value)} />
                  ) : (
                    <Input
                      type={s.kind === 'secret' ? 'password' : 'text'}
                      autoComplete="off"
                      inputMode={s.kind === 'number' ? 'decimal' : undefined}
                      value={String(v)}
                      placeholder={secretSet ? '••••••••' : undefined}
                      onChange={(e) => set(e.target.value)}
                      invalid={!!err}
                    />
                  )}
                </Field>
              );
            })}
          </div>
          {def.group === 'numbering' && Array.isArray(data.sequences) && (
            <div className="mt-6 flex flex-wrap gap-2">
              {(data.sequences as Array<{ docType: string; fy: string; prefix: string; lastNo: number }>).map((s) => (
                <Badge key={`${s.docType}-${s.fy}`} tone="neutral">
                  {labelize(s.docType)} {s.fy}: {s.prefix} · last {fmtNum(s.lastNo)}
                </Badge>
              ))}
            </div>
          )}
          {def.group === 'payment-gateway' && (
            <p className="text-ink-500 mt-4 text-xs">
              Webhook URL to enter in Razorpay:{' '}
              <span className="text-ink-900 font-mono">{`<API host>${String(data.webhookUrl ?? '/webhooks/razorpay')}`}</span>
            </p>
          )}
          <div className="border-line mt-6 flex justify-end gap-2 border-t pt-5">
            {def.group === 'payment-gateway' && (
              <Button variant="secondary" onClick={testGateway} loading={busy === 'test'}>
                <Wifi /> Test connection
              </Button>
            )}
            <Button onClick={save} loading={busy === 'save'}>
              <Save /> Save
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- super admins

function SuperAdmins() {
  const me = useAdminAuth().profile?.admin.id;
  const q = useA<SuperAdmin[]>('/super-admins');
  const [invite, setInvite] = useState(false);
  const { run } = useRun();
  const act = (a: SuperAdmin, path: string, ok: string) =>
    run(path, () => adminApi.post(`/super-admins/${a.id}/${path}`), ok).catch(toastError);
  return (
    <Card>
      <CardHeader
        icon={<Users />}
        title="Super Admins"
        subtitle="Everyone with full access to this panel (two-step sign-in is mandatory)"
        action={
          <Button size="sm" onClick={() => setInvite(true)}>
            <UserPlus /> Invite
          </Button>
        }
      />
      <DataTable
        loading={q.isLoading}
        rows={q.data}
        rowKey={(a) => a.id}
        columns={[
          {
            key: 'n',
            header: 'Name',
            cell: (a) => (
              <div className="flex items-center gap-3">
                <Avatar name={a.name} size={32} />
                <NameCell
                  name={
                    <>
                      {a.name}{' '}
                      {a.id === me && (
                        <Badge size="sm" tone="brand">
                          You
                        </Badge>
                      )}
                    </>
                  }
                  sub={a.email}
                />
              </div>
            ),
          },
          {
            key: 't',
            header: '2FA',
            hideBelow: 'md',
            cell: (a) =>
              a.totpEnabled ? (
                <ShieldCheck className="text-success-600 size-4" />
              ) : (
                <span className="text-ink-300">—</span>
              ),
          },
          {
            key: 'l',
            header: 'Last sign-in',
            hideBelow: 'md',
            cell: (a) => <span className="text-ink-500 text-xs">{fmtRelative(a.lastLoginAt)}</span>,
          },
          { key: 's', header: 'Status', cell: (a) => <StatusBadge status={a.status} size="sm" /> },
          {
            key: 'x',
            header: '',
            align: 'right',
            cell: (a) =>
              a.id === me ? null : (
                <CardMenu
                  items={[
                    {
                      label: 'Resend invitation',
                      icon: <Send className="size-4" />,
                      disabled: a.status !== 'invited',
                      onSelect: () => void act(a, 'resend-invite', 'Invitation sent'),
                    },
                    {
                      label: 'Send password reset',
                      icon: <KeyRound className="size-4" />,
                      disabled: a.status !== 'active',
                      onSelect: () => void act(a, 'reset-password', 'Reset e-mail sent'),
                    },
                    {
                      label: 'Reset two-step sign-in',
                      icon: <RotateCcw className="size-4" />,
                      disabled: !a.totpEnabled,
                      onSelect: () => void act(a, 'reset-2fa', 'They set it up again at next sign-in'),
                    },
                    a.status === 'disabled'
                      ? {
                          label: 'Enable',
                          icon: <Play className="size-4" />,
                          onSelect: () => void act(a, 'enable', 'Enabled'),
                        }
                      : {
                          label: 'Disable',
                          icon: <Power className="size-4" />,
                          danger: true,
                          onSelect: () => void act(a, 'disable', 'Disabled'),
                        },
                  ]}
                />
              ),
          },
        ]}
      />
      {invite && <InviteAdmin onClose={() => setInvite(false)} />}
    </Card>
  );
}

function InviteAdmin({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: '', email: '', mobile: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  async function go() {
    const v = check(superAdminCreateBody, {
      name: f.name.trim(),
      email: f.email.trim(),
      ...(f.mobile.trim() ? { mobile: f.mobile.trim() } : {}),
    });
    if (!v.ok) return setErrors(v.errors);
    try {
      await run('invite', () => adminApi.post('/super-admins', v.data), 'Invitation sent');
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      title="Invite a Super Admin"
      description="They get full access to every client."
      footer={
        <Button block onClick={go} loading={busy === 'invite'}>
          <MailPlus /> Send invitation
        </Button>
      }
    >
      <div className="space-y-4">
        {(['name', 'email', 'mobile'] as const).map((k) => (
          <Field key={k} label={labelize(k)} required={k !== 'mobile'} error={errors[k]}>
            <Input
              type={k === 'email' ? 'email' : 'text'}
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              invalid={!!errors[k]}
            />
          </Field>
        ))}
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------- e-mail templates

interface Tpl {
  code: string;
  channel: string;
  subject: string;
  isActive: boolean;
  updatedAt: string | null;
  bodyHtml?: string;
  bodyText?: string;
}
function EmailTemplates() {
  const q = useA<Tpl[]>('/settings/email-templates');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader
        icon={<Mail />}
        title="E-mail templates"
        subtitle="Use {{variables}} as in the default text; Test sends the template to you"
      />
      <DataTable
        loading={q.isLoading}
        rows={q.data}
        rowKey={(t) => t.code}
        onRowClick={(t) => setOpen(t.code)}
        columns={[
          {
            key: 'c',
            header: 'Code',
            cell: (t) => <span className="text-ink-900 font-mono text-xs font-semibold">{t.code}</span>,
          },
          { key: 's', header: 'Subject', cell: (t) => <span className="text-ink-700 line-clamp-1">{t.subject}</span> },
          {
            key: 'a',
            header: 'Active',
            cell: (t) => (
              <Badge size="sm" tone={t.isActive ? 'success' : 'neutral'}>
                {t.isActive ? 'On' : 'Off'}
              </Badge>
            ),
          },
          {
            key: 'u',
            header: 'Updated',
            hideBelow: 'md',
            cell: (t) => <span className="text-ink-500 text-xs">{fmtDateTime(t.updatedAt)}</span>,
          },
        ]}
      />
      {open && <TemplateDrawer code={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}

function TemplateDrawer({ code, onClose }: { code: string; onClose: () => void }) {
  const q = useA<Tpl>(`/settings/email-templates/${code}`);
  const [f, setF] = useState<{ subject: string; bodyHtml: string; bodyText: string; isActive: boolean } | null>(null);
  const [view, setView] = useState<'html' | 'text' | 'preview'>('html');
  const { run, busy } = useRun();
  useEffect(() => {
    if (q.data && !f)
      setF({
        subject: q.data.subject,
        bodyHtml: q.data.bodyHtml ?? '',
        bodyText: q.data.bodyText ?? '',
        isActive: q.data.isActive,
      });
  }, [q.data, f]);
  const save = () =>
    f && run('save', () => adminApi.put(`/settings/email-templates/${code}`, f), 'Template saved').catch(toastError);
  const test = () =>
    run('test', () => adminApi.post(`/settings/email-templates/${code}/test`), 'Test e-mail sent to you').catch(
      toastError,
    );
  return (
    <Drawer
      open
      width="xl"
      onOpenChange={(o) => !o && onClose()}
      title={code}
      description="Changes apply to the next e-mail sent"
      footer={
        <div className="flex w-full gap-2">
          <Button variant="secondary" onClick={test} loading={busy === 'test'}>
            <Send /> Send test
          </Button>
          <Button className="flex-1" onClick={save} loading={busy === 'save'} disabled={!f}>
            <Save /> Save
          </Button>
        </div>
      }
    >
      {!f ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <div className="space-y-4">
          <Field label="Subject">
            <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
          </Field>
          <label className="rounded-inner border-line flex items-center justify-between border p-3">
            <span className="text-ink-900 text-sm font-medium">Send this e-mail</span>
            <Switch checked={f.isActive} onCheckedChange={(v) => setF({ ...f, isActive: v })} aria-label="Active" />
          </label>
          <Segmented
            value={view}
            onChange={setView}
            items={[
              { value: 'html', label: 'HTML' },
              { value: 'text', label: 'Plain text' },
              { value: 'preview', label: 'Preview' },
            ]}
          />
          {view === 'html' && (
            <Textarea
              rows={16}
              className="font-mono text-xs"
              value={f.bodyHtml}
              onChange={(e) => setF({ ...f, bodyHtml: e.target.value })}
            />
          )}
          {view === 'text' && (
            <Textarea
              rows={16}
              className="font-mono text-xs"
              value={f.bodyText}
              onChange={(e) => setF({ ...f, bodyText: e.target.value })}
            />
          )}
          {view === 'preview' && (
            <div className="rounded-inner border-line overflow-hidden border">
              <p className="bg-canvas text-ink-500 flex items-center gap-2 px-3 py-2 text-xs">
                <Eye className="size-3.5" /> Variables are shown as written
              </p>
              <iframe title="Preview" sandbox="" srcDoc={f.bodyHtml} className="h-[420px] w-full bg-white" />
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
