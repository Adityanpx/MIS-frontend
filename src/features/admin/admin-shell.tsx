'use client';

import { ReceiptIndianRupee } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { Logo } from '@/components/shell/logo';
import { PremiumCard } from '@/components/shell/premium-card';
import { Sidebar } from '@/components/shell/sidebar';
import { UserMenu } from '@/components/shell/topbar';
import { useAdminAuth } from '@/lib/auth/admin-auth';
import { env } from '@/lib/env';
import { usePublicPlatform } from '@/lib/hooks';
import { ADMIN_BOTTOM, ADMIN_SECTIONS, adminCommands } from './nav';

export function AdminShell({ children }: { children: ReactNode }) {
  const auth = useAdminAuth();
  const admin = auth.profile!.admin;
  const platform = usePublicPlatform();
  const commands = useMemo(() => adminCommands(() => void auth.logout()), [auth]);
  return (
    <AppShell
      storageKey="ommis.sidebar.admin"
      commandItems={commands}
      sidebar={({ collapsed, toggle, onNavigate }) => (
        <Sidebar
          layoutGroup="admin-nav"
          collapsed={collapsed}
          onToggleCollapse={toggle}
          onNavigate={onNavigate}
          logo={<Logo name={platform.data?.name ?? env.appName} collapsed={collapsed} />}
          sections={ADMIN_SECTIONS}
          bottom={ADMIN_BOTTOM}
          card={
            <PremiumCard
              icon={<ReceiptIndianRupee />}
              title="Record a payment"
              cta="Record"
              href="/admin/payments/record"
            />
          }
        />
      )}
      topbarRight={
        <UserMenu
          name={admin.name}
          subtitle="Super Admin"
          email={admin.email}
          profileHref="/admin/profile"
          onLogout={() => void auth.logout()}
          onLogoutAll={() => void auth.logoutAll()}
        />
      }
    >
      {children}
    </AppShell>
  );
}
