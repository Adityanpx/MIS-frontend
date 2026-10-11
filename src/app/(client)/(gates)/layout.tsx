import { Suspense, type ReactNode } from 'react';
import { ClientGateGuard } from '@/features/client/guards';

export default function GatesLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <ClientGateGuard>{children}</ClientGateGuard>
    </Suspense>
  );
}
