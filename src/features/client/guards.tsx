'use client';

import { LifeBuoy } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { CenterLoader, ShellSkeleton, StateScreen } from '@/components/feedback/screens';
import { useClientAuth } from '@/lib/auth/client-auth';
import { gateFor, landingPath } from '@/lib/auth/landing';

export function ActAsEnded() {
  return (
    <StateScreen icon={<LifeBuoy />} tone="purple" title="Support session ended">
      This act-as session has expired or was closed. Start a new one from the Super Admin panel if you still need
      access. You can close this tab.
    </StateScreen>
  );
}

function useLoginRedirect(active: boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { endReason } = useClientAuth();
  useEffect(() => {
    if (!active) return;
    const here = pathname + (search.size ? `?${search.toString()}` : '');
    router.replace(endReason === 'logout' || pathname === '/' ? '/login' : `/login?next=${encodeURIComponent(here)}`);
  }, [active, endReason, pathname, router, search]);
}

/** (client)/(app)/layout.tsx — signed in + gates passed, else redirect. */
export function ClientAppGuard({ children }: { children: ReactNode }) {
  const auth = useClientAuth();
  const router = useRouter();
  const pathname = usePathname();
  const gate = auth.profile ? gateFor(auth.profile, pathname) : null;
  useLoginRedirect(auth.status === 'anonymous');
  useEffect(() => {
    if (auth.status === 'authenticated' && gate) router.replace(gate);
  }, [auth.status, gate, router]);

  if (auth.status === 'loading') return <ShellSkeleton />;
  if (auth.status === 'ended') return <ActAsEnded />;
  if (auth.status === 'anonymous' || gate || !auth.profile) return <CenterLoader />;
  return <>{children}</>;
}

/** (client)/(gates)/layout.tsx — signed in, but no shell and no gate loop. */
export function ClientGateGuard({ children }: { children: ReactNode }) {
  const auth = useClientAuth();
  useLoginRedirect(auth.status === 'anonymous');
  if (auth.status === 'ended') return <ActAsEnded />;
  if (auth.status !== 'authenticated') return <CenterLoader />;
  return <>{children}</>;
}

/** (client)/(auth)/* — already signed in? go to the landing page instead of showing the form. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const auth = useClientAuth();
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    if (auth.status === 'authenticated' && auth.profile) router.replace(landingPath(auth.profile, search.get('next')));
  }, [auth.status, auth.profile, router, search]);
  if (auth.status === 'loading' || auth.status === 'authenticated') return <CenterLoader />;
  return <>{children}</>;
}
