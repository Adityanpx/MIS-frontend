'use client';

import { LifeBuoy } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { CenterLoader, StateScreen } from '@/components/feedback/screens';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { landingPath } from '@/lib/auth/landing';
import type { ClientProfile } from '@/lib/auth/types';

/**
 * PRD §7.11 / TRD §5.4.5: the Super Admin panel opens /act-as?code=… in a new tab.
 * The one-time code is exchanged for a short act-as token, kept in memory only (no refresh cookie).
 */
function ActAs() {
  const search = useSearchParams();
  const router = useRouter();
  const auth = useClientAuth();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const code = search.get('code');
    if (!code) {
      setError('This support link is incomplete.');
      return;
    }
    clientApi
      .post<unknown>('/auth/act-as/exchange', { code }, { skipAuth: true })
      .then((data) => {
        const profile = auth.applySession(data, { actAs: true }) as ClientProfile;
        router.replace(landingPath(profile));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [auth, router, search]);

  if (error) {
    return (
      <StateScreen icon={<LifeBuoy />} tone="purple" title="Support link not valid">
        {error} Start a new act-as session from the Super Admin panel.
      </StateScreen>
    );
  }
  return <CenterLoader label="Opening support session…" />;
}

export default function ActAsPage() {
  return (
    <Suspense fallback={<CenterLoader />}>
      <ActAs />
    </Suspense>
  );
}
