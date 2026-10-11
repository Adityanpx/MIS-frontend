import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { RedirectIfSignedIn } from '@/features/client/guards';

export const metadata: Metadata = { title: 'Sign in' };

export default function ClientAuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <RedirectIfSignedIn>
        <AuthLayout area="client">{children}</AuthLayout>
      </RedirectIfSignedIn>
    </Suspense>
  );
}
