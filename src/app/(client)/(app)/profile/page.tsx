'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Factory, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PasswordCard, SessionsCard, TwoFactorCard } from '@/components/account/account-cards';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { clientApi, errorMessage, fieldErrors } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import type { ClientProfile } from '@/lib/auth/types';
import { ROLE_LABEL } from '@/lib/permissions';
import { mobile, personName } from '@/shared/schemas/common';

const schema = z.object({
  name: personName,
  mobile: z.union([mobile, z.literal('')]),
  designation: z.string().trim().max(100),
});

export default function ProfilePage() {
  const auth = useClientAuth();
  const p = auth.profile!;
  const actAs = auth.isActingAs ? 'Not available during a support session.' : undefined;
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: p.user.name, mobile: p.user.mobile ?? '', designation: p.user.designation ?? '' },
  });

  const save = form.handleSubmit(async (v) => {
    try {
      const body = { name: v.name, designation: v.designation, ...(v.mobile ? { mobile: v.mobile } : {}) };
      auth.setProfile(await clientApi.patch<ClientProfile>('/me', body));
      form.reset(v);
      toast.success('Profile saved.');
    } catch (e) {
      const fe = fieldErrors(e);
      Object.entries(fe).forEach(([k, m]) => form.setError(k as keyof z.infer<typeof schema>, { message: m }));
      if (!Object.keys(fe).length) toast.error(errorMessage(e));
    }
  });

  return (
    <>
      <PageHeader title="My profile" subtitle="Your details, password and sign-in security." />
      <Stagger className="grid gap-6 xl:grid-cols-2">
        <StaggerItem>
          <Card className="h-full">
            <CardHeader icon={<UserRound />} title="Personal details" />
            <div className="bg-canvas mb-6 flex items-center gap-4 rounded-2xl p-4">
              <Avatar name={p.user.name} size={56} />
              <div className="min-w-0">
                <p className="text-ink-900 truncate text-base font-semibold">{p.user.name}</p>
                <p className="text-ink-500 truncate text-sm">{p.user.email}</p>
                <div className="mt-1.5 flex gap-1.5">
                  {p.user.isClientAdmin && (
                    <Badge tone="brand" size="sm">
                      Client Admin
                    </Badge>
                  )}
                  <Badge tone="neutral" size="sm">
                    {p.tenant.displayName}
                  </Badge>
                </div>
              </div>
            </div>
            <form onSubmit={save} className="space-y-4" noValidate>
              <Field label="Full name" htmlFor="name" required error={form.formState.errors.name?.message}>
                <Input id="name" {...form.register('name')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Mobile"
                  htmlFor="mobile"
                  hint="10-digit Indian mobile"
                  error={form.formState.errors.mobile?.message}
                >
                  <Input id="mobile" inputMode="tel" placeholder="98XXXXXXXX" {...form.register('mobile')} />
                </Field>
                <Field label="Designation" htmlFor="designation" error={form.formState.errors.designation?.message}>
                  <Input id="designation" placeholder="Plant In-charge" {...form.register('designation')} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
                  Save changes
                </Button>
              </div>
            </form>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <PasswordCard api={clientApi} onSession={(s) => auth.applySession(s)} disabled={actAs} />
        </StaggerItem>
        <StaggerItem>
          <TwoFactorCard
            api={clientApi}
            enabled={p.user.totpEnabled}
            forced={p.tenant.force2fa}
            onChanged={() => void auth.reloadProfile()}
            disabled={actAs}
          />
        </StaggerItem>
        <StaggerItem>
          <SessionsCard onLogoutAll={auth.logoutAll} disabled={auth.isActingAs} />
        </StaggerItem>
        <StaggerItem className="xl:col-span-2">
          <Card>
            <CardHeader icon={<Factory />} title="My plants" subtitle="Roles are managed by your Client Admin." />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {p.plants.map((pl) => (
                <li
                  key={pl.plantId}
                  className="border-line flex items-center justify-between gap-3 rounded-2xl border p-3.5"
                >
                  <div className="min-w-0">
                    <p className="text-ink-900 truncate text-sm font-semibold">{pl.name}</p>
                    <p className="text-ink-500 text-xs">
                      {pl.code} · {ROLE_LABEL[pl.role] ?? pl.role}
                    </p>
                  </div>
                  <StatusBadge status={pl.setupStatus === 'live' ? pl.accountState : pl.setupStatus} size="sm" />
                </li>
              ))}
              {p.plants.length === 0 && <li className="text-ink-500 text-sm">No plants assigned yet.</li>}
            </ul>
          </Card>
        </StaggerItem>
      </Stagger>
    </>
  );
}
