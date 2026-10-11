import { Suspense, type ReactNode } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { AdminRedirectIfSignedIn } from '@/features/admin/guards';

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AdminRedirectIfSignedIn>
        <AuthLayout area="admin">{children}</AuthLayout>
      </AdminRedirectIfSignedIn>
    </Suspense>
  );
}
