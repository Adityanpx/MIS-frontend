'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { CenterLoader, ShellSkeleton } from '@/components/feedback/screens';
import { useAdminAuth } from '@/lib/auth/admin-auth';
import { safeNext } from '@/lib/utils';

/** admin/(panel)/layout.tsx */
export function AdminGuard({ children }: { children: ReactNode }) {
  const auth = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (auth.status !== 'anonymous') return;
    router.replace(
      auth.endReason === 'logout' || pathname === '/admin'
        ? '/admin/login'
        : `/admin/login?next=${encodeURIComponent(pathname)}`,
    );
  }, [auth.status, auth.endReason, pathname, router]);
  if (auth.status === 'loading') return <ShellSkeleton />;
  if (auth.status !== 'authenticated' || !auth.profile) return <CenterLoader />;
  return <>{children}</>;
}

/** admin/(auth)/* */
export function AdminRedirectIfSignedIn({ children }: { children: ReactNode }) {
  const auth = useAdminAuth();
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    if (auth.status === 'authenticated') router.replace(safeNext(search.get('next'), 'admin') ?? '/admin');
  }, [auth.status, router, search]);
  if (auth.status === 'loading' || auth.status === 'authenticated') return <CenterLoader />;
  return <>{children}</>;
}
