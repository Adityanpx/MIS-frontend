'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, LogOut, ShieldCheck, ShieldOff } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field, FormError } from '@/components/ui/field';
import { PasswordInput, PasswordStrength } from '@/components/ui/input';
import { CopyButton } from '@/components/ui/misc';
import { OtpInput } from '@/components/ui/otp-input';
import { errorMessage, fieldErrors, type ApiClient } from '@/lib/api';
import type { EnrolSecret } from '@/lib/auth/types';
import { password as passwordSchema } from '@/shared/schemas/common';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema.refine(
      (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
      'Use at least one letter and one number',
    ),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

/** POST /me/password → returns a fresh session (all other devices are signed out). */
export function PasswordCard({
  api,
  onSession,
  disabled,
}: {
  api: ApiClient;
  onSession: (data: unknown) => void;
  disabled?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const submit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      const s = await api.post<unknown>('/me/password', {
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
      onSession(s);
      form.reset();
      toast.success('Password changed. Other devices were signed out.');
    } catch (e) {
      const fe = fieldErrors(e);
      if (fe.password || fe.newPassword) form.setError('newPassword', { message: fe.password ?? fe.newPassword });
      else if (errorMessage(e).toLowerCase().includes('current'))
        form.setError('currentPassword', { message: errorMessage(e) });
      else setError(errorMessage(e));
    }
  });
  return (
    <Card id="security">
      <CardHeader icon={<KeyRound />} title="Password" subtitle="At least 10 characters with a letter and a number." />
      {disabled ? (
        <p className="bg-canvas text-ink-500 rounded-xl p-3 text-sm">{disabled}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormError message={error} />
          <Field label="Current password" htmlFor="cur" error={form.formState.errors.currentPassword?.message}>
            <PasswordInput id="cur" autoComplete="current-password" {...form.register('currentPassword')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" htmlFor="np" error={form.formState.errors.newPassword?.message}>
              <PasswordInput id="np" autoComplete="new-password" {...form.register('newPassword')} />
            </Field>
            <Field label="Confirm" htmlFor="cf" error={form.formState.errors.confirm?.message}>
              <PasswordInput id="cf" autoComplete="new-password" {...form.register('confirm')} />
            </Field>
          </div>
          <PasswordStrength value={form.watch('newPassword')} />
          <div className="flex justify-end">
            <Button type="submit" loading={form.formState.isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** Client users only: optional TOTP (setup → enable, or disable unless the company forces 2FA). */
export function TwoFactorCard({
  api,
  enabled,
  forced,
  onChanged,
  disabled,
}: {
  api: ApiClient;
  enabled: boolean;
  forced: boolean;
  onChanged: () => void;
  disabled?: string;
}) {
  const [secret, setSecret] = useState<EnrolSecret | null>(null);
  const [mode, setMode] = useState<'enable' | 'disable' | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setError(null);
    setCode('');
    try {
      setSecret(await api.post<EnrolSecret>('/me/2fa/setup'));
      setMode('enable');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  const confirm = async (c: string) => {
    if (c.length !== 6 || !mode) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(mode === 'enable' ? '/me/2fa/enable' : '/me/2fa/disable', { code: c });
      toast.success(mode === 'enable' ? 'Two-step verification is on.' : 'Two-step verification is off.');
      setMode(null);
      setSecret(null);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader
        icon={enabled ? <ShieldCheck /> : <ShieldOff />}
        title="Two-step verification"
        subtitle="A 6-digit code from an authenticator app at every sign-in."
        action={
          <Badge tone={enabled ? 'success' : 'neutral'} dot>
            {enabled ? 'On' : 'Off'}
          </Badge>
        }
      />
      {disabled ? (
        <p className="bg-canvas text-ink-500 rounded-xl p-3 text-sm">{disabled}</p>
      ) : enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-500 text-sm">
            {forced ? 'Required by your company — it cannot be turned off.' : 'Your account is protected.'}
          </p>
          {!forced && (
            <Button
              variant="danger-soft"
              onClick={() => {
                setMode('disable');
                setCode('');
                setError(null);
              }}
            >
              Turn off
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-500 text-sm">Recommended for every account.</p>
          <Button onClick={start}>Set up</Button>
        </div>
      )}

      <Modal
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        icon={<ShieldCheck />}
        title={mode === 'enable' ? 'Turn on two-step verification' : 'Turn off two-step verification'}
        description={
          mode === 'enable'
            ? 'Scan the QR code, then enter the code the app shows.'
            : 'Enter a current code from your authenticator app.'
        }
      >
        {mode === 'enable' && secret && (
          <div className="mb-5 flex items-center gap-4">
            <div className="border-line rounded-2xl border bg-white p-2.5">
              <QRCodeSVG value={secret.otpauthUrl} size={120} />
            </div>
            <div className="text-ink-500 min-w-0 text-xs">
              Or enter this key:
              <code className="text-ink-900 mt-1 block font-mono text-[12px] font-semibold break-all">
                {secret.secret}
              </code>
              <CopyButton value={secret.secret} className="mt-2" label="Copy key" />
            </div>
          </div>
        )}
        <div className="space-y-4">
          <FormError message={error} />
          <OtpInput value={code} onChange={setCode} onComplete={confirm} invalid={!!error} disabled={busy} />
          <Button
            block
            loading={busy}
            disabled={code.length !== 6}
            variant={mode === 'disable' ? 'danger' : 'primary'}
            onClick={() => confirm(code)}
          >
            {mode === 'enable' ? 'Turn on' : 'Turn off'}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

export function SessionsCard({ onLogoutAll, disabled }: { onLogoutAll: () => Promise<void>; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader icon={<LogOut />} title="Sessions" subtitle="Lost a phone or used a shared computer?" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-500 text-sm">Sign out everywhere, including this browser.</p>
        <Button variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
          Sign out of all devices
        </Button>
      </div>
      <Modal
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        icon={<LogOut />}
        title="Sign out of all devices?"
        description="Every session, including this one, ends within a few seconds."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onLogoutAll();
                } catch (e) {
                  toast.error(errorMessage(e));
                  setBusy(false);
                }
              }}
            >
              Sign out everywhere
            </Button>
          </>
        }
      />
    </Card>
  );
}
