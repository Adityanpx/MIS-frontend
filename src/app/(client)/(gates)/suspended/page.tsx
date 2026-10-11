'use client';

import { Ban, Mail, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { StateScreen } from '@/components/feedback/screens';
import { Button } from '@/components/ui/button';
import { useClientAuth } from '@/lib/auth/client-auth';
import { gateFor, landingPath } from '@/lib/auth/landing';
import { usePublicPlatform } from '@/lib/hooks';

/** Non-admin users of a suspended or terminated company land here (PRD §9.2). */
export default function SuspendedPage() {
  const auth = useClientAuth();
  const router = useRouter();
  const platform = usePublicPlatform();
  const p = auth.profile;
  useEffect(() => {
    if (p && gateFor(p, '/suspended') === null && !['suspended', 'terminated'].includes(p.tenant.accountState))
      router.replace(landingPath(p));
  }, [p, router]);
  const support = platform.data;
  return (
    <StateScreen
      icon={<Ban />}
      tone="danger"
      title={p?.tenant.accountState === 'terminated' ? 'This account has been closed' : 'This account is suspended'}
      actions={
        <Button variant="secondary" onClick={() => void auth.logout()}>
          Sign out
        </Button>
      }
    >
      <p>
        Access for <b className="text-ink-900">{p?.tenant.displayName}</b> is paused. Please contact your company
        administrator.
      </p>
      {(support?.supportEmail || support?.supportPhone) && (
        <div className="mt-4 flex flex-col items-center gap-1.5 text-[13px]">
          {support.supportEmail && (
            <a
              href={`mailto:${support.supportEmail}`}
              className="text-brand-500 inline-flex items-center gap-1.5 font-medium"
            >
              <Mail className="size-4" />
              {support.supportEmail}
            </a>
          )}
          {support.supportPhone && (
            <a
              href={`tel:${support.supportPhone}`}
              className="text-brand-500 inline-flex items-center gap-1.5 font-medium"
            >
              <Phone className="size-4" />
              {support.supportPhone}
            </a>
          )}
        </div>
      )}
    </StateScreen>
  );
}
