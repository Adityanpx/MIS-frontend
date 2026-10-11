import { Suspense, type ReactNode } from 'react';
import { ClientShell } from '@/features/client/client-shell';
import { ClientAppGuard } from '@/features/client/guards';

/** Every signed-in client page: guard (session + gates) → shell (sidebar, topbar, banners). */
export default function ClientAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <ClientAppGuard>
        <ClientShell>{children}</ClientShell>
      </ClientAppGuard>
    </Suspense>
  );
}
