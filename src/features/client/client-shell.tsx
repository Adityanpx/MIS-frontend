'use client';

import { LifeBuoy, Wallet } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { Logo } from '@/components/shell/logo';
import { PremiumCard } from '@/components/shell/premium-card';
import { Sidebar } from '@/components/shell/sidebar';
import { UserMenu } from '@/components/shell/topbar';
import { useClientAuth } from '@/lib/auth/client-auth';
import { defaultPlant } from '@/lib/auth/landing';
import type { ClientProfile } from '@/lib/auth/types';
import { usePublicPlatform } from '@/lib/hooks';
import { ROLE_LABEL } from '@/lib/permissions';
import { ActAsBanner, LifecycleBanners } from './banners';
import { clientCommands, clientNav } from './nav';
import { PlantSwitcher } from './plant-switcher';
import { useBillingSummary } from './queries';

function SidebarCard({ profile }: { profile: ClientProfile }) {
  const isCA = profile.user.isClientAdmin && !profile.actingAs;
  const billing = useBillingSummary(isCA);
  const platform = usePublicPlatform();
  if (isCA) {
    const b = billing.data;
    const overdue = b && Number(b.overdue) > 0;
    return (
      <PremiumCard
        icon={<Wallet />}
        title={overdue ? 'Payment overdue' : 'Plan & billing'}
        cta={overdue ? 'Pay now' : 'Billing'}
        href="/billing"
      />
    );
  }
  const email = platform.data?.supportEmail;
  return (
    <PremiumCard icon={<LifeBuoy />} title="Need help?" cta="Support" href={email ? `mailto:${email}` : '/profile'} />
  );
}

/** Sidebar + topbar + banners for the client area (wraps every page inside (client)/(app)). */
export function ClientShell({ children }: { children: ReactNode }) {
  const auth = useClientAuth();
  const profile = auth.profile!;
  const pathname = usePathname();
  const platform = usePublicPlatform();

  const current = useMemo(() => {
    const id = /^\/plants\/([^/]+)/.exec(pathname)?.[1];
    return profile.plants.find((p) => p.plantId === id) ?? defaultPlant(profile);
  }, [pathname, profile]);
  const nav = useMemo(() => clientNav(profile, current), [profile, current]);
  const commands = useMemo(() => clientCommands(profile, () => void auth.logout()), [profile, auth]);
  const role = profile.user.isClientAdmin
    ? 'Client Admin'
    : profile.user.isManagement
      ? 'Management'
      : current
        ? ROLE_LABEL[current.role]
        : (profile.user.designation ?? '');

  return (
    <AppShell
      storageKey="ommis.sidebar.client"
      commandItems={commands}
      helpHref={platform.data?.supportEmail ? `mailto:${platform.data.supportEmail}` : undefined}
      banners={
        <>
          <ActAsBanner />
          <LifecycleBanners />
        </>
      }
      sidebar={({ collapsed, toggle, onNavigate }) => (
        <Sidebar
          layoutGroup="client-nav"
          collapsed={collapsed}
          onToggleCollapse={toggle}
          onNavigate={onNavigate}
          logo={<Logo name={profile.tenant.displayName} logoUrl={profile.tenant.logoUrl} collapsed={collapsed} />}
          top={
            profile.plants.length > 0 ? (
              <PlantSwitcher plants={profile.plants} current={current} collapsed={collapsed} />
            ) : undefined
          }
          sections={nav.sections}
          bottom={nav.bottom}
          card={<SidebarCard profile={profile} />}
        />
      )}
      topbarRight={
        <UserMenu
          name={profile.user.name}
          subtitle={role}
          email={profile.user.email}
          profileHref="/profile"
          onLogout={() => void auth.logout()}
          onLogoutAll={auth.isActingAs ? undefined : () => void auth.logoutAll()}
        />
      }
    >
      {children}
    </AppShell>
  );
}
