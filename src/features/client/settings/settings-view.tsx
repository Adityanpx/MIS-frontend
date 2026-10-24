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
import { EmptyState, ProgressBar } from '@/components/ui/misc';
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
  const visible = SECTIONS.filter((s) => !s.caOnly || plant.myRole === 'client_admin');
  const id = params.section?.[0] ?? (pending ? 'go-live' : 'general');
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
      />
      {pending && items.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-premium relative mb-6 overflow-hidden text-white">
            <div className="dot-grid absolute inset-0 opacity-20" />
            <div className="relative flex flex-wrap items-center gap-5">
              <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
                <Rocket className="size-6" />
              </span>
              <div className="min-w-[220px] flex-1">
                <p className="text-base font-semibold">Finish setting up {plant.name}</p>
                <p className="text-sm text-white/70">
                  {okCount} of {items.length} checks complete — logsheets open after go-live.
                </p>
                <ProgressBar
                  className="mt-3 max-w-md bg-white/20"
                  value={okCount}
                  max={items.length}
                  tone="success"
                  height={6}
                />
              </div>
              <Button variant="white" onClick={() => setGuided(true)}>
                Continue guided setup
              </Button>
            </div>
          </Card>
        </motion.div>
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
