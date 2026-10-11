'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ImageUp, Mail, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { DASH, fmtDateTime } from '@/lib/format';
import { isWriteBlocked } from '@/lib/permissions';
import { qk } from '@/lib/query/keys';
import { companyPatchBody } from '@/shared/schemas/company';
import { Fact } from '../settings/parts';
import { apiErrors, checkBody } from '../settings/queries';
import { ClientAdminOnly, type CompanyDto } from './company-api';

/** /company — company profile (CA-04). Legal name, GSTIN, PAN, state and address drive invoices: Super Admin only. */
export function CompanyProfile() {
  const signedIn = useClientAuth().status === 'authenticated';
  const isAdmin = !!useClientAuth().profile?.user.isClientAdmin;
  const { reloadProfile, profile } = useClientAuth();
  const blocked = isWriteBlocked(profile?.tenant.accountState); // PATCH / logo answer 423 in read-only
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: qk.client.company,
    queryFn: () => clientApi.get<CompanyDto>('/company'),
    enabled: signedIn && isAdmin, // Client Admin only (403 otherwise)
  });
  const [v, setV] = useState({ displayName: '', name: '', email: '', mobile: '', emails: [''] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const logo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const c = q.data;
    if (!c) return;
    setV({
      displayName: c.displayName,
      name: c.primaryContact?.name ?? '',
      email: c.primaryContact?.email ?? '',
      mobile: c.primaryContact?.mobile ?? '',
      emails: c.billingEmails.length ? c.billingEmails : [''],
    });
  }, [q.data]);

  async function save() {
    const c = checkBody(companyPatchBody, {
      displayName: v.displayName,
      primaryContact: { name: v.name, email: v.email, mobile: v.mobile.trim() || undefined },
      billingEmails: v.emails.map((e) => e.trim()).filter(Boolean),
    });
    if (!c.ok) return setErrors(c.errors);
    setErrors({});
    setBusy(true);
    try {
      qc.setQueryData(qk.client.company, await clientApi.patch<CompanyDto>('/company', c.data));
      toast.success('Company profile saved');
      void reloadProfile();
    } catch (e) {
      setErrors(apiErrors(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File | undefined) {
    if (!f) return;
    if (f.size > 1024 * 1024) return void toast.error('The logo must be under 1 MB.');
    const fd = new FormData();
    fd.append('file', f);
    try {
      qc.setQueryData(qk.client.company, await clientApi.upload<CompanyDto>('/company/logo', fd));
      toast.success('Logo updated');
      void reloadProfile();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const c = q.data;
  const addr = c
    ? [c.address?.line1, c.address?.line2, c.address?.city, c.stateName, c.address?.pin].filter(Boolean).join(', ')
    : '';
  return (
    <ClientAdminOnly title="Company profile">
      <PageHeader
        title="Company profile"
        subtitle="How your company appears in OMMIS and where invoices are sent"
        badge={c ? <StatusBadge status={c.accountState} /> : undefined}
      />
      {q.isError ? (
        <Card>
          <EmptyState icon={<Building2 />} title="Could not load the company" description={errorMessage(q.error)} />
        </Card>
      ) : !c ? (
        <Skeleton className="rounded-card h-96" />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="flex flex-col items-center text-center">
            <button
              type="button"
              disabled={blocked}
              onClick={() => logo.current?.click()}
              className="border-line bg-canvas hover:border-brand-300 group relative grid size-28 place-items-center overflow-hidden rounded-3xl border transition-colors"
              aria-label="Change logo"
            >
              {c.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logoUrl} alt="" className="size-full object-contain p-3" />
              ) : (
                <Building2 className="text-ink-300 size-10" />
              )}
              <span className="bg-ink-900/50 absolute inset-0 grid place-items-center text-white opacity-0 transition-opacity group-hover:opacity-100">
                <ImageUp className="size-6" />
              </span>
            </button>
            <input
              ref={logo}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              hidden
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            <p className="text-ink-900 mt-4 text-lg font-semibold">{c.displayName}</p>
            <p className="text-ink-500 text-sm">{c.code}</p>
            <div className="mt-6 grid w-full grid-cols-2 gap-3">
              <div className="rounded-inner bg-canvas p-3">
                <p className="text-ink-900 text-2xl font-semibold">{c.plantsCount}</p>
                <p className="text-ink-500 text-xs">plants</p>
              </div>
              <div className="rounded-inner bg-canvas p-3">
                <p className="text-ink-900 text-2xl font-semibold">{c.usersCount}</p>
                <p className="text-ink-500 text-xs">users (active + invited)</p>
              </div>
            </div>
            <p className="text-ink-400 mt-4 text-xs">
              Terms {c.termsVersion ?? DASH} accepted {c.termsAcceptedAt ? fmtDateTime(c.termsAcceptedAt) : DASH}
            </p>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Legal & tax details"
                subtitle="Printed on invoices — ask the OMMIS team to change them"
              />
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <Fact label="Legal name">{c.legalName}</Fact>
                <Fact label="GSTIN">{c.gstin ?? DASH}</Fact>
                <Fact label="PAN">{c.pan ?? DASH}</Fact>
                <Fact label="State">{`${c.stateName} (${c.stateCode})`}</Fact>
                <Fact label="Address" className="sm:col-span-2">
                  <span className="font-medium whitespace-normal">{addr || DASH}</span>
                </Fact>
              </div>
            </Card>
            <Card>
              <CardHeader title="Contact & billing" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Display name" required error={errors.displayName} className="sm:col-span-2">
                  <Input value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} />
                </Field>
                <Field label="Primary contact" required error={errors['primaryContact.name']}>
                  <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
                </Field>
                <Field label="Contact e-mail" required error={errors['primaryContact.email']}>
                  <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
                </Field>
                <Field label="Contact mobile" error={errors['primaryContact.mobile']}>
                  <Input inputMode="tel" value={v.mobile} onChange={(e) => setV({ ...v, mobile: e.target.value })} />
                </Field>
              </div>
              <div className="mt-6">
                <p className="text-ink-900 text-sm font-semibold">Invoice e-mails</p>
                <p className="text-ink-500 mb-3 text-xs">
                  Invoices, receipts and reminders go to these addresses (1–3).
                </p>
                <div className="space-y-2">
                  {v.emails.map((e, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        type="email"
                        leading={<Mail />}
                        value={e}
                        invalid={!!errors[`billingEmails.${i}`]}
                        aria-label={`Invoice e-mail ${i + 1}`}
                        onChange={(ev) =>
                          setV({ ...v, emails: v.emails.map((x, j) => (j === i ? ev.target.value : x)) })
                        }
                      />
                      {v.emails.length > 1 && (
                        <IconButton
                          aria-label="Remove"
                          onClick={() => setV({ ...v, emails: v.emails.filter((_, j) => j !== i) })}
                        >
                          <X />
                        </IconButton>
                      )}
                    </div>
                  ))}
                  {errors.billingEmails && <p className="text-danger-600 text-xs">{errors.billingEmails}</p>}
                  {v.emails.length < 3 && (
                    <Button size="sm" variant="ghost" onClick={() => setV({ ...v, emails: [...v.emails, ''] })}>
                      <Plus /> Add e-mail
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={save} loading={busy} disabled={blocked}>
                  Save changes
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </ClientAdminOnly>
  );
}
