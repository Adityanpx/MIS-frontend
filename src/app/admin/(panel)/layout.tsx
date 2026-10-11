import { Suspense, type ReactNode } from 'react';
import { AdminShell } from '@/features/admin/admin-shell';
import { AdminGuard } from '@/features/admin/guards';

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <AdminGuard>
        <AdminShell>{children}</AdminShell>
      </AdminGuard>
    </Suspense>
  );
}
