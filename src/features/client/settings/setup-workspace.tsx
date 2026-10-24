'use client';

import * as D from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  FlaskConical,
  IndianRupee,
  Rocket,
  Settings2,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { EASE_OUT } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/misc';
import { clientApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePlant } from '../plant-context';
import { CashSection } from './cash-section';
import { ConstantsSection } from './constants-section';
import { ContractSection } from './contract-section';
import { GeneralSection } from './general-section';
import { GoLiveSection } from './golive-section';
import { ParametersSection } from './parameters-section';
import { PeopleSection } from './people-section';
import { PanelCard, useCanEditSettings } from './parts';
import { apiErrors, useSettings } from './queries';
import { StockSection } from './stock-section';
import type { ParameterDto } from './types';

interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
  /** one plain-language sentence: what this step is and why it is needed */
  intro: string;
  /** go-live checks this step satisfies (none = nothing is required here) */
  checks: string[];
  /** the settings sections this step covers (the go-live checklist jumps by section) */
  sections: string[];
  optional?: boolean;
  caOnly?: boolean;
}

const STEPS: Step[] = [
  {
    id: 'start',
    label: 'Quick start',
    icon: Sparkles,
    intro:
      'Fill the plant with the standard set-up in one click, then check each step. Or start empty and add everything yourself.',
    checks: ['parameters'],
    sections: ['template'],
  },
  {
    id: 'general',
    label: 'Plant basics',
    icon: Settings2,
    intro: 'The names that appear on your reports and logsheets, and the date your MIS starts from.',
    checks: [],
    sections: ['general'],
  },
  {
    id: 'parameters',
    label: 'Parameters & limits',
    icon: SlidersHorizontal,
    intro:
      'Everything you record every day (flow, power, lab results), its unit, and the limit each value is checked against.',
    checks: ['units', 'standards', 'lab_limits'],
    sections: ['parameters'],
  },
  {
    id: 'constants',
    label: 'Constants',
    icon: Sigma,
    intro: 'Fixed numbers the reports use in their calculations, such as design capacity or tariffs.',
    checks: [],
    sections: ['constants'],
  },
  {
    id: 'stock',
    label: 'Chemicals & stock',
    icon: FlaskConical,
    intro: 'The chemicals you keep on site and how much of each you have today. This is your opening balance.',
    checks: ['stock_opening'],
    sections: ['stock'],
  },
  {
    id: 'people',
    label: 'Staff & safety',
    icon: Users,
    intro: 'How many people you need on site by category, and the safety items that must be in place.',
    checks: ['staff', 'safety'],
    sections: ['staff', 'safety'],
  },
  {
    id: 'cash',
    label: 'Site cash',
    icon: Banknote,
    intro: 'The petty cash held on site today, and the amount at which you want to be warned.',
    checks: ['cash_opening'],
    sections: ['cash'],
  },
  {
    id: 'contract',
    label: 'Contract & revenue',
    icon: IndianRupee,
    intro: 'The fees from your contract, so revenue can be worked out correctly.',
    checks: ['contract_fees'],
    sections: ['contract'],
    caOnly: true,
  },
  {
    id: 'review',
    label: 'Review & go live',
    icon: Rocket,
    intro: 'Check that nothing is missing. Select any red item to fix it, then take the plant live.',
    checks: [],
    sections: [],
  },
];

/** Applies the standard set-up to a plant that has no parameters yet (same call as Templates & import). */
function QuickStart({ onNext }: { onNext: () => void }) {
  const { plant } = usePlant();
  const canEdit = useCanEditSettings();
  const qc = useQueryClient();
  const paramCount = useSettings('parameters').data?.length ?? 0;
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    try {
      await clientApi.post<ParameterDto[]>(`/plants/${plant.id}/settings/apply-template`);
      await qc.invalidateQueries({ queryKey: ['c', 'plant', plant.id] });
      toast.success('Standard set-up applied', {
        description: 'Now check each step. Change anything that is different for your plant.',
      });
      onNext();
    } catch (e) {
      apiErrors(e);
    } finally {
      setBusy(false);
    }
  }

  const filled = paramCount > 0;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PanelCard className="text-center">
        <span className="bg-brand-50 text-brand-500 mx-auto grid size-16 place-items-center rounded-3xl">
          <Sparkles className="size-7" />
        </span>
        <h3 className="text-ink-900 mt-5 text-xl font-semibold">
          {filled ? 'The standard set-up is already in place' : 'Start with the standard set-up'}
        </h3>
        <p className="text-ink-500 mx-auto mt-2 max-w-lg text-sm">
          {filled
            ? `${paramCount} parameters are ready. Go through the next steps and change anything that is different for your plant.`
            : 'One click adds the usual parameters, limits, constants, chemicals, staff and safety items. You then review each step and edit what you need. Nothing is final until you go live.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!filled && (
            <Button size="lg" onClick={apply} loading={busy} disabled={!canEdit}>
              <Sparkles /> Fill with defaults
            </Button>
          )}
          <Button size="lg" variant={filled ? 'primary' : 'secondary'} onClick={onNext}>
            {filled ? 'Review the steps' : 'Start empty instead'} <ArrowRight />
          </Button>
        </div>
        {!filled && !canEdit && (
          <p className="text-ink-400 mt-4 text-xs">Only a Client Admin can fill in the defaults.</p>
        )}
      </PanelCard>
    </div>
  );
}

/**
 * Guided plant setup in one large popup: a step list on the left, the full editable section in the middle,
 * Back / Continue underneath. Reuses the existing settings sections, so every save and check is the same as
 * on the settings page; it only changes how the client is led through them.
 */
export function SetupWorkspace({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { plant, can } = usePlant();
  const check = useSettings('go-live-check', can('settings.view'));
  const [idx, setIdx] = useState(0);
  const mainRef = useRef<HTMLDivElement>(null);
  const steps = STEPS.filter((s) => !s.caOnly || plant.myRole === 'client_admin');
  const step = steps[Math.min(idx, steps.length - 1)]!;
  const items = check.data?.items ?? [];
  const okKeys = new Set(items.filter((i) => i.ok).map((i) => i.key));
  const done = (s: Step) => s.checks.length > 0 && s.checks.every((k) => okKeys.has(k));
  const required = steps.filter((s) => s.checks.length > 0);
  const doneCount = required.filter(done).length;
  const live = plant.setupStatus === 'live';

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [step.id]);

  const go = (n: number) => setIdx(Math.max(0, Math.min(steps.length - 1, n)));
  const jumpToSection = (section: string) => {
    const n = steps.findIndex((s) => s.sections.includes(section));
    if (n >= 0) go(n);
  };

  function body(): ReactNode {
    switch (step.id) {
      case 'start':
        return <QuickStart onNext={() => go(idx + 1)} />;
      case 'general':
        return <GeneralSection />;
      case 'parameters':
        return <ParametersSection />;
      case 'constants':
        return <ConstantsSection />;
      case 'stock':
        return <StockSection />;
      case 'people':
        return (
          <div className="space-y-10">
            <PeopleSection kind="staff" />
            <PeopleSection kind="safety" />
          </div>
        );
      case 'cash':
        return <CashSection />;
      case 'contract':
        return <ContractSection />;
      default:
        return <GoLiveSection onJump={jumpToSection} />;
    }
  }

  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="bg-ink-900/40 fixed inset-0 z-50 backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </D.Overlay>
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-0 sm:p-4 lg:p-6">
              <D.Content
                asChild
                forceMount
                // drawers and dialogs opened from a section sit outside this node; never close on their clicks
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
              >
                <motion.div
                  className="bg-canvas shadow-float pointer-events-auto flex h-full max-h-full w-full max-w-[1500px] flex-col overflow-hidden focus:outline-none sm:rounded-3xl"
                  initial={{ opacity: 0, scale: 0.97, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: 10 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                  {/* header */}
                  <header className="border-line bg-surface flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-5 py-4 sm:px-7">
                    <span className="bg-brand-50 text-brand-500 grid size-11 shrink-0 place-items-center rounded-2xl">
                      <Rocket className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <D.Title className="text-ink-900 truncate text-lg font-semibold tracking-tight">
                        {live ? 'Plant set-up' : `Set up ${plant.name}`}
                      </D.Title>
                      <D.Description className="text-ink-500 truncate text-sm">
                        {live
                          ? 'This plant is live. You can still review or change any step.'
                          : `Step ${idx + 1} of ${steps.length} · ${doneCount} of ${required.length} required steps complete`}
                      </D.Description>
                    </div>
                    {!live && required.length > 0 && (
                      <ProgressBar
                        className="hidden w-56 md:block"
                        value={doneCount}
                        max={required.length}
                        tone="success"
                        height={6}
                      />
                    )}
                    <Button variant="secondary" onClick={onClose}>
                      <X /> Save &amp; close
                    </Button>
                  </header>

                  <div className="flex min-h-0 flex-1">
                    {/* step list (desktop) */}
                    <nav
                      aria-label="Setup steps"
                      className="border-line bg-surface hidden w-[270px] shrink-0 overflow-y-auto border-r p-4 lg:block"
                    >
                      <ol className="space-y-1">
                        {steps.map((s, n) => {
                          const active = n === idx;
                          const ok = done(s);
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                onClick={() => go(n)}
                                aria-current={active ? 'step' : undefined}
                                className={cn(
                                  'relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                                  active ? 'text-brand-500' : 'text-ink-700 hover:bg-canvas',
                                )}
                              >
                                {active && (
                                  <motion.span
                                    layoutId="setup-step"
                                    className="bg-brand-50 absolute inset-0 rounded-xl"
                                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                                  />
                                )}
                                <span
                                  className={cn(
                                    'relative grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                                    ok
                                      ? 'bg-success-600 text-white'
                                      : active
                                        ? 'bg-brand-500 text-white'
                                        : 'bg-canvas text-ink-500 border-line border',
                                  )}
                                >
                                  {ok ? <Check className="size-4" /> : n + 1}
                                </span>
                                <span className="relative min-w-0 flex-1 truncate">{s.label}</span>
                                {s.checks.length > 0 && !ok && !live && (
                                  <span
                                    className="bg-danger-500 relative size-2 shrink-0 rounded-full"
                                    title="Still needed"
                                  />
                                )}
                                {s.checks.length === 0 && s.id !== 'start' && s.id !== 'review' && (
                                  <span className="text-ink-400 relative text-[11px]">optional</span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </nav>

                    {/* current step */}
                    <div className="flex min-w-0 flex-1 flex-col">
                      {/* step list (phones / tablets) */}
                      <div className="scrollbar-none border-line bg-surface flex gap-2 overflow-x-auto border-b px-4 py-3 lg:hidden">
                        {steps.map((s, n) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => go(n)}
                            className={cn(
                              'border-line inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium',
                              n === idx ? 'bg-ink-900 border-ink-900 text-white' : 'bg-surface text-ink-700',
                            )}
                          >
                            {done(s) ? <Check className="text-success-600 size-4" /> : <s.icon className="size-4" />}
                            {s.label}
                          </button>
                        ))}
                      </div>

                      <div ref={mainRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mx-auto max-w-5xl"
                          >
                            <div className="bg-brand-50/60 border-brand-100 mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3">
                              <step.icon className="text-brand-500 mt-0.5 size-5 shrink-0" />
                              <p className="text-ink-700 text-sm">{step.intro}</p>
                            </div>
                            {body()}
                          </motion.div>
                        </AnimatePresence>
                      </div>

                      {/* footer */}
                      <footer className="border-line bg-surface flex items-center justify-between gap-3 border-t px-5 py-3.5 sm:px-8">
                        <Button variant="ghost" onClick={() => go(idx - 1)} disabled={idx === 0}>
                          <ArrowLeft /> Back
                        </Button>
                        {idx < steps.length - 1 ? (
                          <div className="flex items-center gap-3">
                            {step.checks.length === 0 && step.id !== 'start' && (
                              <span className="text-ink-400 hidden text-xs sm:inline">
                                Optional: skip if it does not apply
                              </span>
                            )}
                            <Button onClick={() => go(idx + 1)}>
                              {step.checks.length === 0 && step.id !== 'start' ? 'Skip or continue' : 'Continue'}{' '}
                              <ArrowRight />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="secondary" onClick={onClose}>
                            Close
                          </Button>
                        )}
                      </footer>
                    </div>
                  </div>
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
