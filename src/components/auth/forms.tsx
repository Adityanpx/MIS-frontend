'use client';

/**
 * Sign-in flows shared by the client app (base '') and the Super Admin panel (base '/admin').
 * They only call the auth context; navigation after a successful session is done by the route guards.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, MailCheck, ShieldCheck, Smartphone } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FormError } from '@/components/ui/field';
import { Input, PasswordInput, PasswordStrength } from '@/components/ui/input';
import { CopyButton, Skeleton } from '@/components/ui/misc';
import { OtpInput } from '@/components/ui/otp-input';
import { errorMessage, fieldErrors, hasCode } from '@/lib/api';
import type { AuthContextValue } from '@/lib/auth/create-auth';
import type { EnrolSecret } from '@/lib/auth/types';
import { email as emailSchema, password as passwordSchema } from '@/shared/schemas/common';
import { AuthHeading } from './auth-layout';

type AuthApi = Pick<
  AuthContextValue<unknown>,
  'login' | 'verifyMfa' | 'startEnrol' | 'confirmEnrol' | 'acceptInvite' | 'forgot' | 'reset' | 'mfa' | 'status'
>;

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password').max(128) });
const newPasswordSchema = z
  .object({
    password: passwordSchema.refine(
      (v) => /[A-Za-z]/.test(v) && /\d/.test(v),
      'Use at least one letter and one number',
    ),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

// ------------------------------------------------------------------ login
export function LoginForm({
  auth,
  base,
  title,
  subtitle,
}: {
  auth: AuthApi;
  base: '' | '/admin';
  title: string;
  subtitle: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const { register, handleSubmit, formState } = form;

  const onSubmit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      const step = await auth.login(v.email, v.password);
      if (step === 'verify') router.push(`${base}/login/2fa`);
      else if (step === 'enrol') router.push(`${base}/login/enrol`);
    } catch (e) {
      setServerError(errorMessage(e));
      if (hasCode(e, 'INVALID_CREDENTIALS')) form.setValue('password', '');
    }
  });

  return (
    <>
      <AuthHeading title={title} subtitle={subtitle} />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={serverError} />
        <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            leading={<Mail />}
            placeholder="you@company.com"
            invalid={!!formState.errors.email}
            {...register('email')}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={formState.errors.password?.message}
          labelRight={
            <Link href={`${base}/forgot-password`} className="text-brand-500 text-xs font-medium hover:underline">
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••••"
            invalid={!!formState.errors.password}
            {...register('password')}
          />
        </Field>
        <Button type="submit" size="lg" block loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </>
  );
}

// ------------------------------------------------------------------ 2FA verify
export function TwoFactorForm({ auth, base }: { auth: AuthApi; base: '' | '/admin' }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.mfa && auth.status === 'anonymous') router.replace(`${base}/login`);
  }, [auth.mfa, auth.status, base, router]);

  const submit = async (c: string) => {
    if (busy || c.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await auth.verifyMfa(c);
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AuthHeading
        icon={<ShieldCheck />}
        title="Two-step verification"
        subtitle="Enter the 6-digit code from your authenticator app."
      />
      <div className="space-y-5">
        {/* TEMP TESTING (remove before go-live): the API only sends devCode on non-production builds. */}
        {auth.mfa?.devCode && (
          <div className="border-warning-200 bg-warning-50 text-warning-700 flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
            <span>
              Testing code: <span className="font-mono font-semibold tracking-widest">{auth.mfa.devCode}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setCode(auth.mfa!.devCode!);
                void submit(auth.mfa!.devCode!);
              }}
            >
              Use this code
            </Button>
          </div>
        )}
        <FormError message={error} />
        <OtpInput value={code} onChange={setCode} onComplete={submit} invalid={!!error} disabled={busy} />
        <Button size="lg" block loading={busy} disabled={code.length !== 6} onClick={() => submit(code)}>
          Verify
        </Button>
        <BackToLogin base={base} />
      </div>
    </>
  );
}

// ------------------------------------------------------------------ 2FA enrolment (forced)
export function EnrolForm({ auth, base }: { auth: AuthApi; base: '' | '/admin' }) {
  const router = useRouter();
  const [secret, setSecret] = useState<EnrolSecret | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!auth.mfa) {
      if (auth.status === 'anonymous') router.replace(`${base}/login`);
      return;
    }
    if (started.current) return;
    started.current = true;
    auth
      .startEnrol()
      .then(setSecret)
      .catch((e) => setError(errorMessage(e)));
  }, [auth, base, router]);

  const submit = async (c: string) => {
    if (busy || c.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await auth.confirmEnrol(c);
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const grouped = secret?.secret.replace(/(.{4})/g, '$1 ').trim();
  return (
    <>
      <AuthHeading
        icon={<Smartphone />}
        title="Set up two-step verification"
        subtitle="Your organisation requires an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…)."
      />
      {/* TEMP TESTING (remove before go-live): the API only sends devCode on non-production builds. */}
      {secret?.devCode && (
        <div className="border-warning-200 bg-warning-50 text-warning-700 mb-5 flex items-center justify-between rounded-xl border px-4 py-3 text-sm">
          <span>
            Testing code: <span className="font-mono font-semibold tracking-widest">{secret.devCode}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setCode(secret.devCode!);
              void submit(secret.devCode!);
            }}
          >
            Use this code
          </Button>
        </div>
      )}
      <ol className="space-y-5">
        <li className="flex gap-4">
          <Step n={1} />
          <div className="min-w-0 flex-1">
            <p className="text-ink-900 text-sm font-medium">Scan this QR code with the app</p>
            <div className="mt-3 flex items-center gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className="border-line shadow-card grid size-[150px] shrink-0 place-items-center rounded-2xl border bg-white p-2.5"
              >
                {secret ? (
                  <QRCodeSVG value={secret.otpauthUrl} size={128} level="M" />
                ) : (
                  <Skeleton className="size-32" />
                )}
              </motion.div>
              <div className="text-ink-500 min-w-0 text-xs">
                Can&apos;t scan? Enter this key:
                <code className="bg-canvas text-ink-900 mt-1.5 block rounded-lg px-2 py-1.5 font-mono text-[12px] font-semibold break-all">
                  {grouped ?? '…'}
                </code>
                {secret && <CopyButton value={secret.secret} className="mt-2" label="Copy key" />}
              </div>
            </div>
          </div>
        </li>
        <li className="flex gap-4">
          <Step n={2} />
          <div className="min-w-0 flex-1 space-y-4">
            <p className="text-ink-900 text-sm font-medium">Enter the 6-digit code it shows</p>
            <FormError message={error} />
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={submit}
              invalid={!!error}
              disabled={busy || !secret}
              autoFocus={false}
            />
            <Button size="lg" block loading={busy} disabled={code.length !== 6} onClick={() => submit(code)}>
              Turn on and sign in
            </Button>
          </div>
        </li>
      </ol>
      <div className="mt-6">
        <BackToLogin base={base} />
      </div>
    </>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="bg-brand-500 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white">
      {n}
    </span>
  );
}

function BackToLogin({ base }: { base: '' | '/admin' }) {
  return (
    <Link
      href={`${base}/login`}
      className="text-ink-500 hover:text-ink-900 inline-flex items-center gap-1.5 text-sm font-medium"
    >
      <ArrowLeft className="size-4" /> Back to sign in
    </Link>
  );
}

// ------------------------------------------------------------------ forgot password
export function ForgotForm({ auth, base }: { auth: AuthApi; base: '' | '/admin' }) {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: emailSchema })),
    defaultValues: { email: '' },
  });
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      setSent(await auth.forgot(v.email));
    } catch (e) {
      setError(errorMessage(e));
    }
  });
  if (sent) {
    return (
      <Done icon={<MailCheck />} title="Check your email" text={sent}>
        <BackToLogin base={base} />
      </Done>
    );
  }
  return (
    <>
      <AuthHeading
        icon={<KeyRound />}
        title="Forgot your password?"
        subtitle="Enter your work email. If it is registered, we will send a reset link valid for a short time."
      />
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <FormError message={error} />
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            leading={<Mail />}
            placeholder="you@company.com"
            {...form.register('email')}
          />
        </Field>
        <Button type="submit" size="lg" block loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
        <BackToLogin base={base} />
      </form>
    </>
  );
}

// ------------------------------------------------------------------ set a new password (reset + invite)
function NewPasswordForm({
  onSave,
  submitLabel,
}: {
  onSave: (password: string) => Promise<void>;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });
  const pw = form.watch('password');
  const onSubmit = form.handleSubmit(async (v) => {
    setError(null);
    try {
      await onSave(v.password);
    } catch (e) {
      const fe = fieldErrors(e);
      if (fe.password) form.setError('password', { message: fe.password });
      else setError(errorMessage(e));
    }
  });
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field label="New password" htmlFor="password" error={form.formState.errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          invalid={!!form.formState.errors.password}
          {...form.register('password')}
        />
        <PasswordStrength value={pw} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={form.formState.errors.confirm?.message}>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          invalid={!!form.formState.errors.confirm}
          {...form.register('confirm')}
        />
      </Field>
      <Button type="submit" size="lg" block loading={form.formState.isSubmitting}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function ResetForm({ auth, base, token }: { auth: AuthApi; base: '' | '/admin'; token: string }) {
  const [done, setDone] = useState<string | null>(null);
  if (done) {
    return (
      <Done icon={<CheckCircle2 />} title="Password changed" text={done}>
        <Button asChild size="lg" block>
          <Link href={`${base}/login`}>Sign in</Link>
        </Button>
      </Done>
    );
  }
  return (
    <>
      <AuthHeading
        icon={<KeyRound />}
        title="Choose a new password"
        subtitle="All your other sessions will be signed out."
      />
      <NewPasswordForm submitLabel="Change password" onSave={async (p) => setDone(await auth.reset(token, p))} />
      <div className="mt-5">
        <BackToLogin base={base} />
      </div>
    </>
  );
}

export function InviteForm({ auth, base, token }: { auth: AuthApi; base: '' | '/admin'; token: string }) {
  const router = useRouter();
  return (
    <>
      <AuthHeading
        icon={<CheckCircle2 />}
        title="Welcome aboard"
        subtitle="Set a password to activate your account. You will be signed in right after."
      />
      <NewPasswordForm
        submitLabel="Activate account"
        onSave={async (p) => {
          const step = await auth.acceptInvite(token, p);
          if (step === 'verify') router.push(`${base}/login/2fa`);
          else if (step === 'enrol') router.push(`${base}/login/enrol`);
        }}
      />
    </>
  );
}

function Done({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <div className="text-center">
      <motion.span
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="bg-success-50 text-success-600 mx-auto grid size-16 place-items-center rounded-3xl [&_svg]:size-8"
      >
        {icon}
      </motion.span>
      <h1 className="text-ink-900 mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-ink-500 mx-auto mt-2 max-w-sm text-sm">{text}</p>
      <div className="mt-8 flex justify-center">{children}</div>
    </div>
  );
}
