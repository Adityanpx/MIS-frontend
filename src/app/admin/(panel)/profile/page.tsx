'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PasswordCard, SessionsCard } from '@/components/account/account-cards';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';
import { adminApi, errorMessage } from '@/lib/api';
import { useAdminAuth } from '@/lib/auth/admin-auth';
import type { AdminProfile } from '@/lib/auth/types';
import { fmtDateTime } from '@/lib/format';
import { mobile, personName } from '@/shared/schemas/common';

const schema = z.object({ name: personName, mobile: z.union([mobile, z.literal('')]) });

export default function AdminProfilePage() {
  const auth = useAdminAuth();
  const a = auth.profile!.admin;
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: a.name, mobile: a.mobile ?? '' },
  });
  const save = form.handleSubmit(async (v) => {
    try {
      const res = await adminApi.patch<AdminProfile | AdminProfile['admin']>('/me', {
        name: v.name,
        mobile: v.mobile || null,
      });
      auth.setProfile('admin' in res ? res : { admin: res });
      form.reset(v);
      toast.success('Profile saved.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });
  return (
    <>
      <PageHeader title="My profile" subtitle={`Last sign-in ${fmtDateTime(a.lastLoginAt)}`} />
      <Stagger className="grid gap-6 xl:grid-cols-2">
        <StaggerItem>
          <Card className="h-full">
            <CardHeader icon={<UserRound />} title="Personal details" />
            <div className="bg-canvas mb-6 flex items-center gap-4 rounded-2xl p-4">
              <Avatar name={a.name} size={56} />
              <div className="min-w-0">
                <p className="text-ink-900 truncate font-semibold">{a.name}</p>
                <p className="text-ink-500 truncate text-sm">{a.email}</p>
                <Badge tone="dark" size="sm" className="mt-1.5">
                  Super Admin
                </Badge>
              </div>
            </div>
            <form onSubmit={save} className="space-y-4" noValidate>
              <Field label="Full name" htmlFor="name" error={form.formState.errors.name?.message}>
                <Input id="name" {...form.register('name')} />
              </Field>
              <Field label="Mobile" htmlFor="mobile" error={form.formState.errors.mobile?.message}>
                <Input id="mobile" inputMode="tel" {...form.register('mobile')} />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
                  Save changes
                </Button>
              </div>
            </form>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <PasswordCard api={adminApi} onSession={(s) => auth.applySession(s)} />
        </StaggerItem>
        <StaggerItem>
          <Card>
            <CardHeader
              icon={<ShieldCheck />}
              title="Two-step verification"
              action={
                <Badge tone="success" dot>
                  Always on
                </Badge>
              }
            />
            <p className="text-ink-500 text-sm">
              Two-step verification is compulsory for Super Admins. To move it to a new phone, ask another Super Admin
              to reset your access.
            </p>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <SessionsCard onLogoutAll={auth.logoutAll} />
        </StaggerItem>
      </Stagger>
    </>
  );
}
