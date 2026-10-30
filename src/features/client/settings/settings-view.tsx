'use client';

import {
  Banknote,
  HardHat,
  IndianRupee,
  Landmark,
  LayoutTemplate,
  Package,
  Rocket,
  Settings2,
  ShieldCheck,
  Sigma,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { PageFade } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { usePlant } from '../plant-context';
import { CashSection } from './cash-section';
import { ConstantsSection } from './constants-section';
import { ContractSection } from './contract-section';
import { GeneralSection } from './general-section';
import { CHECK_SECTION, GoLiveSection } from './golive-section';
import { ParametersSection } from './parameters-section';
import { PeopleSection } from './people-section';
import { useSettings } from './queries';
import { RegistersSection } from './registers-section';
import { SetupWorkspace } from './setup-workspace';
import { StockSection } from './stock-section';
import { TemplateSection } from './template-section';

interface SectionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  render: () => ReactNode;
  caOnly?: boolean;
}
const SECTIONS: SectionDef[] = [
  { id: 'go-live', label: 'Go-live', icon: Rocket, group: 'Setup', render: () => <GoLiveSection /> },
  { id: 'general', label: 'General', icon: Settings2, group: 'Plant', render: () => <GeneralSection /> },
  {
    id: 'parameters',
    label: 'Parameters',
    icon: SlidersHorizontal,
    group: 'Plant',
    render: () => <ParametersSection />,
  },
  { id: 'constants', label: 'Constants', icon: Sigma, group: 'Plant', render: () => <ConstantsSection /> },
  { id: 'stock', label: 'Chemicals & stock', icon: Package, group: 'Operations', render: () => <StockSection /> },
  {
    id: 'staff',
    label: 'Staff strength',
    icon: Users,
    group: 'Operations',
    render: () => <PeopleSection kind="staff" />,
  },
  {
    id: 'safety',
    label: 'Safety items',
    icon: HardHat,
    group: 'Operations',
    render: () => <PeopleSection kind="safety" />,
  },
  { id: 'cash', label: 'Site cash', icon: Banknote, group: 'Operations', render: () => <CashSection /> },
  {
    id: 'contract',
    label: 'Contract & revenue',
    icon: IndianRupee,
    group: 'Contract',
    caOnly: true,
    render: () => <ContractSection />,
  },
  {
    id: 'guarantees',
    label: 'Bank guarantees',
    icon: Landmark,
    group: 'Contract',
    render: () => <RegistersSection kind="bank-guarantees" />,
  },
  {
    id: 'insurance',
    label: 'Insurance',
    icon: ShieldCheck,
    group: 'Contract',
    render: () => <RegistersSection kind="insurance" />,
  },
  {
    id: 'template',
    label: 'Templates & import',
    icon: LayoutTemplate,
    group: 'Tools',
    caOnly: true,
    render: () => <TemplateSection />,
  },
];

/** sections the popup (its sheet tabs) handles, before and after go-live */
const IN_SETUP_POPUP = new Set(['parameters', 'constants', 'stock', 'staff', 'safety', 'cash', 'contract']);

/** /plants/:id/settings/[section] — every plant setting in one place (PRD §11). */
export function SettingsView() {
  const { plant, can } = usePlant();
  const params = useParams<{ section?: string[] }>();
  const pending = plant.setupStatus === 'settings_pending';
  const check = useSettings('go-live-check', can('settings.view'));
  const [guided, setGuided] = useState(false);
  const canGuide = pending && can('settings.edit');

  // A plant that is not live yet opens the guided setup once per browser session.
  useEffect(() => {
    if (!canGuide) return;
    try {
      const k = `ommis.setup.${plant.id}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, '1');
    } catch {
      /* storage blocked: still open it */
    }
    setGuided(true);
  }, [canGuide, plant.id]);
  // These sections are edited in the popup's sheets, so the menu leaves them out. The Go-live page is only needed while pending.
  const visible = SECTIONS.filter(
    (s) =>
      (!s.caOnly || plant.myRole === 'client_admin') && !(IN_SETUP_POPUP.has(s.id) || (pending && s.id === 'go-live')),
  );
  const requested = params.section?.[0];
  const id =
    !requested || IN_SETUP_POPUP.has(requested) || (pending && requested === 'go-live') ? 'general' : requested;
  if ((params.section?.length ?? 0) > 1) notFound();
  const current = visible.find((s) => s.id === id);

  if (!can('settings.view')) {
    return (
      <>
        <PageHeader title="Plant settings" />
        <Card>
          <EmptyState
            icon={<Settings2 />}
            title="Not available for your role"
            description="Plant settings are visible to Editors, Checkers, Verifiers and Client Admins."
          />
        </Card>
      </>
    );
  }
  if (!current) notFound();

  const items = check.data?.items ?? [];
  const okCount = items.filter((i) => i.ok).length;
  const missing = new Set(items.filter((i) => !i.ok).map((i) => CHECK_SECTION[i.key]?.section));
  const groups = [...new Set(visible.map((s) => s.group))];
  const href = (s: string) => `/plants/${plant.id}/settings/${s}`;

  return (
    <>
      <PageHeader
        title="Plant settings"
        subtitle={`${plant.name} · ${plant.code}`}
        badge={<StatusBadge status={plant.setupStatus} />}
        actions={
          plant.setupStatus === 'live' && can('settings.edit') ? (
            <Button variant="secondary" onClick={() => setGuided(true)}>
              <Rocket /> Edit parameters &amp; set-up
            </Button>
          ) : undefined
        }
      />
      {canGuide && items.length > 0 && (
        <div className="border-brand-100 bg-brand-50/60 mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border px-5 py-4">
          <div className="min-w-[240px] flex-1">
            <p className="text-ink-900 text-sm font-semibold">
              {okCount === items.length
                ? 'Everything is filled in. You can go live.'
                : `Setup is not finished: ${items.length - okCount} of ${items.length} checks still need your input`}
            </p>
            {okCount < items.length && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {items
                  .filter((i) => !i.ok)
                  .map((i) => (
                    <span
                      key={i.key}
                      title={i.message}
                      className="text-danger-600 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium"
                    >
                      {CHECK_SECTION[i.key]?.label ?? i.key}
                    </span>
                  ))}
              </div>
            )}
          </div>
          <Button onClick={() => setGuided(true)}>
            <Rocket /> {okCount === items.length ? 'Review & go live' : 'Continue remaining setup'}
          </Button>
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* desktop: vertical menu · phones: scrolling pills */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-[96px]">
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
            {visible.map((s) => (
              <Link
                key={s.id}
                href={href(s.id)}
                className={cn(
                  'border-line inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium',
                  s.id === id ? 'bg-ink-900 border-ink-900 text-white' : 'bg-surface text-ink-700',
                )}
              >
                <s.icon className="size-4" />
                {s.label}
              </Link>
            ))}
          </div>
          <Card padded={false} className="hidden p-3 lg:block">
            {groups.map((g) => (
              <div key={g} className="mb-2 last:mb-0">
                <p className="text-ink-400 px-3 pt-2 pb-1.5 text-[11px] font-medium tracking-wider uppercase">{g}</p>
                {visible
                  .filter((s) => s.group === g)
                  .map((s) => {
                    const active = s.id === id;
                    return (
                      <Link
                        key={s.id}
                        href={href(s.id)}
                        className={cn(
                          'relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                          active ? 'text-brand-500' : 'text-ink-700 hover:bg-canvas',
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="settings-nav"
                            className="bg-brand-50 absolute inset-0 rounded-xl"
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          />
                        )}
                        <s.icon className="relative size-[18px]" />
                        <span className="relative flex-1 truncate">
                          {s.id === 'go-live' && !pending ? 'Plant status' : s.label}
                        </span>
                        {s.id === 'go-live' && pending && items.length > 0 && (
                          <span className="bg-warning-50 text-warning-600 tabular relative rounded-md px-1.5 text-[11px] font-semibold">
                            {okCount}/{items.length}
                          </span>
                        )}
                        {pending && missing.has(s.id) && (
                          <span className="bg-danger-500 relative size-2 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </Card>
        </nav>
        <PageFade id={id} className="min-w-0">
          {current.render()}
        </PageFade>
      </div>
      <SetupWorkspace open={guided} onClose={() => setGuided(false)} />
    </>
  );
}
