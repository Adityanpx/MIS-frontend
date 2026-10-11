import type { ReactNode } from 'react';
import { ClientAuthProvider } from '@/lib/auth/client-auth';

/** Everything under (client) — sign-in pages, gates, act-as and the app — shares ONE client session. */
export default function ClientAreaLayout({ children }: { children: ReactNode }) {
  return <ClientAuthProvider>{children}</ClientAuthProvider>;
}
