'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, MailPlus, Power, Send, ShieldCheck, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, SearchInput } from '@/components/ui/input';
import { Avatar, Switch } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/tabs';
import { DataTable, Pagination } from '@/components/ui/table';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { fmtRelative } from '@/lib/format';
import { isWriteBlocked, ROLE_LABEL } from '@/lib/permissions';
import { qk } from '@/lib/query/keys';
import { PLANT_ROLES, type PlantRole } from '@/shared/enums';
import { userInviteBody, userPatchBody } from '@/shared/schemas/company';
import { usePlants } from '../queries';
import { apiErrors, checkBody } from '../settings/queries';
import { ClientAdminOnly, type UserDto } from './company-api';

type Status = 'all' | 'active' | 'invited' | 'disabled';
const PAGE = 20;
const roleOptions = [
  { value: 'none', label: 'No access' },
  ...PLANT_ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] ?? r })),
];

function UserDrawer({
  user,
  open,
  onOpenChange,
}: {
  user: UserDto | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const plants = usePlants();
  const { profile, reloadProfile } = useClientAuth();
  const blocked = isWriteBlocked(profile?.tenant.accountState);
  const [v, setV] = useState({ name: '', email: '', mobile: '', designation: '', isClientAdmin: false });
  const [roles, setRoles] = useState<Record<string, PlantRole | 'none'>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const isNew = !user;
  const isMe = user?.id === profile?.user.id;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setV({
      name: user?.name ?? '',
      email: user?.email ?? '',
      mobile: user?.mobile ?? '',
      designation: user?.designation ?? '',
      isClientAdmin: user?.isClientAdmin ?? false,
    });
    setRoles(Object.fromEntries((user?.plantRoles ?? []).map((r) => [r.plantId, r.role])));
  }, [open, user]);

  const roleList = Object.entries(roles)
    .filter(([, r]) => r !== 'none')
    .map(([plantId, role]) => ({ plantId, role: role as PlantRole }));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['c', 'company'] });
    if (isMe) void reloadProfile();
  };

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      refresh();
      return true;
    } catch (e) {
      setErrors(apiErrors(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (isNew) {
      const c = checkBody(userInviteBody, {
        name: v.name,
        email: v.email,
        mobile: v.mobile.trim() || undefined,
        designation: v.designation.trim() || undefined,
        isClientAdmin: v.isClientAdmin,
        plantRoles: v.isClientAdmin ? [] : roleList,
      });
      if (!c.ok) return setErrors(c.errors);
      if (await run('save', () => clientApi.post('/company/users', c.data), `Invitation sent to ${v.email}`))
        onOpenChange(false);
      return;
    }
    const patch: Record<string, unknown> = {};
    if (v.name !== user.name) patch.name = v.name;
    if ((v.mobile || null) !== user.mobile) patch.mobile = v.mobile.trim() || null;
    if ((v.designation || null) !== user.designation) patch.designation = v.designation.trim() || null;
    if (v.isClientAdmin !== user.isClientAdmin) patch.isClientAdmin = v.isClientAdmin;
    const c = checkBody(userPatchBody, patch);
    if (!c.ok) return setErrors(c.errors);
    const rolesChanged =
      JSON.stringify([...roleList].sort((a, b) => a.plantId.localeCompare(b.plantId))) !==
      JSON.stringify(
        [...user.plantRoles]
          .map(({ plantId, role }) => ({ plantId, role }))
          .sort((a, b) => a.plantId.localeCompare(b.plantId)),
      );
    const ok = await run(
      'save',
      async () => {
        if (Object.keys(c.data).length) await clientApi.patch(`/company/users/${user.id}`, c.data);
        if (rolesChanged && !v.isClientAdmin) {
          try {
            await clientApi.put(`/company/users/${user.id}/plant-roles`, { roles: roleList });
          } catch (e) {
            // the details above are already saved — say so, then show why the roles were refused
            if (Object.keys(c.data).length) {
              refresh();
              toast.message('Name and details saved; the plant roles were not changed.');
            }
            throw e;
          }
        }
      },
      'User saved',
    );
    if (ok) onOpenChange(false);
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={isNew ? 'Invite a user' : user.name}
      description={isNew ? 'They receive an e-mail to set their password. Roles can be changed any time.' : user.email}
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          {!isNew && user.status === 'invited' && (
            <Button
              variant="ghost"
              disabled={blocked}
              loading={busy === 'resend'}
              onClick={() =>
                void run(
                  'resend',
                  () => clientApi.post(`/company/users/${user.id}/resend-invite`),
                  'Invitation sent again',
                )
              }
            >
              <Send /> Resend invite
            </Button>
          )}
          {!isNew && user.status === 'active' && (
            <Button
              variant="ghost"
              disabled={blocked}
              loading={busy === 'reset'}
              onClick={() =>
                void run(
                  'reset',
                  () => clientApi.post(`/company/users/${user.id}/reset-password`),
                  'Password reset e-mail sent',
                )
              }
            >
              <KeyRound /> Reset password
            </Button>
          )}
          {!isNew && !isMe && (
            <Button
              variant={user.status === 'disabled' ? 'soft' : 'danger-soft'}
              disabled={blocked}
              loading={busy === 'status'}
              onClick={() =>
                void run(
                  'status',
                  () =>
                    clientApi.post(`/company/users/${user.id}/${user.status === 'disabled' ? 'enable' : 'disable'}`),
                  user.status === 'disabled' ? 'User enabled' : 'User disabled — signed out everywhere',
                ).then((ok) => ok && onOpenChange(false))
              }
            >
              <Power /> {user.status === 'disabled' ? 'Enable' : 'Disable'}
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy === 'save'} disabled={blocked}>
            {isNew ? (
              <>
                <MailPlus /> Send invitation
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name}>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <Field label="Work e-mail" required error={errors.email}>
            <Input
              type="email"
              value={v.email}
              disabled={!isNew}
              onChange={(e) => setV({ ...v, email: e.target.value })}
            />
          </Field>
          <Field label="Mobile" error={errors.mobile} hint="Indian number, optional">
            <Input inputMode="tel" value={v.mobile} onChange={(e) => setV({ ...v, mobile: e.target.value })} />
          </Field>
          <Field label="Designation" error={errors.designation}>
            <Input value={v.designation} onChange={(e) => setV({ ...v, designation: e.target.value })} />
          </Field>
        </div>
        <div className="rounded-inner border-line flex items-center justify-between gap-4 border p-4">
          <div>
            <p className="text-ink-900 flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="text-brand-500 size-4" /> Client Admin
            </p>
            <p className="text-ink-500 text-xs">Every plant, settings, users, billing and exports.</p>
          </div>
          <Switch
            checked={v.isClientAdmin}
            disabled={isMe}
            onCheckedChange={(x) => setV({ ...v, isClientAdmin: x })}
            aria-label="Client Admin"
          />
        </div>
        {!v.isClientAdmin && (
          <div>
            <p className="text-ink-900 mb-1 text-sm font-semibold">Plant roles</p>
            <p className="text-ink-500 mb-3 text-xs">
              Editor fills logsheets · Checker / Verifier review · Viewer reads reports. One role per plant.
            </p>
            <ul className="rounded-inner border-line divide-line divide-y border">
              {(plants.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-ink-900 truncate text-sm font-medium">{p.name}</p>
                    <p className="text-ink-400 text-xs">{p.code}</p>
                  </div>
                  <Select
                    size="sm"
                    className="w-40"
                    value={roles[p.id] ?? 'none'}
                    onValueChange={(r) => setRoles({ ...roles, [p.id]: r as PlantRole | 'none' })}
                    options={roleOptions}
                    aria-label={`Role on ${p.name}`}
                  />
                </li>
              ))}
            </ul>
            {errors.plantRoles && <p className="text-danger-600 mt-2 text-xs">{errors.plantRoles}</p>}
          </div>
        )}
      </div>
    </Drawer>
  );
}

/** /company/users — users and plant roles (CA-05…08). */
export function UsersView() {
  const signedIn = useClientAuth().status === 'authenticated';
  const isAdmin = !!useClientAuth().profile?.user.isClientAdmin;
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<{ user: UserDto | null } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const query = { q: debounced || undefined, status: status === 'all' ? undefined : status, page, pageSize: PAGE };
  const list = useQuery({
    queryKey: qk.client.users(query),
    queryFn: () => clientApi.list<UserDto>('/company/users', query),
    enabled: signedIn && isAdmin, // Client Admin only (403 otherwise)
    placeholderData: keepPreviousData,
  });
  const show = (user: UserDto | null) => {
    setSel({ user });
    setOpen(true);
  };
  return (
    <ClientAdminOnly title="Users & roles">
      <PageHeader
        title="Users & roles"
        subtitle="Who can sign in, and what they can do on each plant"
        actions={
          <Button onClick={() => show(null)}>
            <UserPlus /> Invite user
          </Button>
        }
      />
      <Card padded={false} className="mb-6 flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or e-mail…" />
        </div>
        <Segmented
          value={status}
          onChange={(s) => {
            setStatus(s);
            setPage(1);
          }}
          items={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'invited', label: 'Invited' },
            { value: 'disabled', label: 'Disabled' },
          ]}
        />
      </Card>
      <Card>
        <DataTable
          loading={list.isLoading}
          rows={list.data?.items}
          rowKey={(u) => u.id}
          onRowClick={(u) => show(u)}
          empty={list.isError ? errorMessage(list.error) : 'No users match.'}
          columns={[
            {
              key: 'name',
              header: 'User',
              cell: (u) => (
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} size={36} />
                  <div className="min-w-0">
                    <p className="text-ink-900 truncate font-semibold">{u.name}</p>
                    <p className="text-ink-500 truncate text-xs">{u.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'roles',
              header: 'Access',
              cell: (u) =>
                u.isClientAdmin ? (
                  <Badge tone="brand">
                    <ShieldCheck /> Client Admin
                  </Badge>
                ) : u.plantRoles.length ? (
                  <div className="flex flex-wrap gap-1">
                    {u.plantRoles.slice(0, 3).map((r) => (
                      <Badge key={r.plantId} tone="neutral" size="sm">
                        {r.plantName} · {ROLE_LABEL[r.role]}
                      </Badge>
                    ))}
                    {u.plantRoles.length > 3 && <Badge size="sm">+{u.plantRoles.length - 3}</Badge>}
                  </div>
                ) : (
                  <span className="text-ink-400 text-xs">No plant yet</span>
                ),
            },
            {
              key: 'status',
              header: 'Status',
              width: '120px',
              cell: (u) => <StatusBadge status={u.status} size="sm" />,
            },
            {
              key: '2fa',
              header: '2FA',
              width: '70px',
              hideBelow: 'md',
              cell: (u) =>
                u.totpEnabled ? (
                  <Badge tone="success" size="sm">
                    On
                  </Badge>
                ) : (
                  <span className="text-ink-400 text-xs">Off</span>
                ),
            },
            {
              key: 'login',
              header: 'Last sign-in',
              width: '130px',
              hideBelow: 'lg',
              cell: (u) => (
                <span className="text-ink-500 text-xs">{u.lastLoginAt ? fmtRelative(u.lastLoginAt) : 'Never'}</span>
              ),
            },
          ]}
        />
        {list.data && list.data.meta.total > PAGE && (
          <Pagination
            className="mt-4"
            page={page}
            pageSize={PAGE}
            total={list.data.meta.total}
            onPageChange={setPage}
          />
        )}
      </Card>
      {sel && <UserDrawer key={sel.user?.id ?? 'new'} user={sel.user} open={open} onOpenChange={setOpen} />}
    </ClientAdminOnly>
  );
}
