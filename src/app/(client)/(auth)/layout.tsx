import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { WakeBackend } from '@/components/auth/wake-backend';
import { RedirectIfSignedIn } from '@/features/client/guards';

export const metadata: Metadata = { title: 'Sign in' };

export default function ClientAuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <RedirectIfSignedIn>
        <WakeBackend />
        <AuthLayout area="client">{children}</AuthLayout>
      </RedirectIfSignedIn>
    </Suspense>
  );
}
