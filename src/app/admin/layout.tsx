import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminAuthProvider } from '@/lib/auth/admin-auth';

export const metadata: Metadata = {
  title: { default: 'Super Admin', template: '%s · Super Admin' },
  robots: { index: false, follow: false },
};

/** Everything under /admin shares ONE Super Admin session (separate cookie sa_rt, separate token). */
export default function AdminAreaLayout({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
