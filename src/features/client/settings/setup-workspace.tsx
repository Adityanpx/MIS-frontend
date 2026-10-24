'use client';

import * as D from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Check,
  CheckCircle2,
  FlaskConical,
  IndianRupee,
  Loader2,
  Rocket,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { EASE_OUT } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { clientApi } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { usePlant } from '../plant-context';
import { CHECK_SECTION } from './golive-section';
import { useCanEditSettings } from './parts';
import { apiErrors, useSettings } from './queries';
import { SheetProvider } from './sheet/cells';
import { CashTab } from './sheet/cash-tab';
import { ConstantsTab } from './sheet/constants-tab';
import { ContractTab } from './sheet/contract-tab';
import { ParametersTab } from './sheet/parameters-tab';
import { PeopleTab } from './sheet/people-tab';
import { StockTab } from './sheet/stock-tab';
import type { ParameterDto } from './types';

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  /** go-live checks that live on this tab */
  checks: string[];
  caOnly?: boolean;
}
const TABS: Tab[] = [
  {
    id: 'parameters',
    label: 'Parameters',
    icon: SlidersHorizontal,
    checks: ['parameters', 'units', 'standards', 'lab_limits'],
  },
  { id: 'constants', label: 'Constants', icon: Sigma, checks: [] },
  { id: 'stock', label: 'Chemicals & stock', icon: FlaskConical, checks: ['stock_opening'] },
  { id: 'people', label: 'Staff & safety', icon: Users, checks: ['staff', 'safety'] },
  { id: 'cash', label: 'Site cash', icon: Banknote, checks: ['cash_opening'] },
  { id: 'contract', label: 'Contract fees', icon: IndianRupee, checks: ['contract_fees'], caOnly: true },
];
const tabOfCheck = (key: string) => TABS.find((t) => t.checks.includes(key))?.id;

/** Shown while the plant has no parameters at all: fill everything with the standard set-up, or start empty. */
function QuickStart({ onEmpty }: { onEmpty: () => void }) {
  const { plant } = usePlant();
  const canEdit = useCanEditSettings();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function apply() {
    setBusy(true);
    try {
      await clientApi.post<ParameterDto[]>(`/plants/${plant.id}/settings/apply-template`);
      await qc.invalidateQueries({ queryKey: qk.client.plant(plant.id) });
      toast.success('Standard set-up added', {
        description: 'Check each tab and change what is different for your plant.',
      });
    } catch (e) {
      apiErrors(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl py-10 text-center">
      <span className="bg-brand-50 text-brand-500 mx-auto grid size-16 place-items-center rounded-3xl">
        <Sparkles className="size-7" />
      </span>
      <h3 className="text-ink-900 mt-5 text-xl font-semibold">Start with the standard set-up</h3>
      <p className="text-ink-500 mt-2 text-sm">
        One click fills every tab with the usual parameters, limits, constants, chemicals, staff and safety items. You
        then check the sheets and change anything that is different for your plant.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={apply} loading={busy} disabled={!canEdit}>
          <Sparkles /> Fill with defaults
        </Button>
        <Button size="lg" variant="secondary" onClick={onEmpty}>
          Start empty
        </Button>
      </div>
      {!canEdit && <p className="text-ink-400 mt-4 text-xs">Only a Client Admin can fill in the defaults.</p>}
    </div>
  );
}

/**
 * Plant set-up as one big popup that works like a small spreadsheet: tabs along the top, a table in each,
 * type into any cell and it saves when you leave it. One Go live button at the bottom.
 * Every cell calls the same settings API as the full settings page.
 */
export function SetupWorkspace({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { plant, can } = usePlant();
  const canEdit = useCanEditSettings();
  const qc = useQueryClient();
  const { reloadProfile } = useClientAuth();
  const check = useSettings('go-live-check', can('settings.view'));
  const params = useSettings('parameters');
  const [tab, setTab] = useState('parameters');
  const [startedEmpty, setStartedEmpty] = useState(false);
  const [busy, setBusy] = useState({ pending: 0, failed: false, saved: false });
  const [confirm, setConfirm] = useState(false);
  const [going, setGoing] = useState(false);
  const onBusy = useCallback(
    (pending: number, failed: boolean) =>
      setBusy((b) => ({ pending, failed, saved: b.saved || (pending === 0 && !failed) })),
    [],
  );

  const tabs = TABS.filter((t) => !t.caOnly || plant.myRole === 'client_admin');
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]!;
  const items = check.data?.items ?? [];
  const failing = new Set(items.filter((i) => !i.ok).map((i) => i.key));
  const left = items.filter((i) => !i.ok);
  const live = plant.setupStatus === 'live';
  const emptyPlant = !!params.data && params.data.length === 0 && !startedEmpty;

  async function goLive() {
    setGoing(true);
    try {
      await clientApi.post(`/plants/${plant.id}/settings/go-live`);
      setConfirm(false);
      void qc.invalidateQueries({ queryKey: qk.client.plants });
      await qc.invalidateQueries({ queryKey: qk.client.plant(plant.id) });
      await reloadProfile();
      toast.success(`${plant.name} is live`, {
        description: 'Logsheets are open and reports are calculated every day.',
      });
      onClose();
    } catch (e) {
      apiErrors(e);
    } finally {
      setGoing(false);
    }
  }

  function body(): ReactNode {
    switch (current.id) {
      case 'parameters':
        return emptyPlant ? <QuickStart onEmpty={() => setStartedEmpty(true)} /> : <ParametersTab />;
      case 'constants':
        return <ConstantsTab />;
      case 'stock':
        return <StockTab />;
      case 'people':
        return <PeopleTab />;
      case 'cash':
        return <CashTab />;
      default:
        return <ContractTab />;
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
            <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-0 sm:px-8 sm:py-4 lg:px-20 lg:py-6">
              <D.Content
                asChild
                forceMount
                // drawers and dialogs opened from a sheet sit outside this node; never close on their clicks
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
                  <SheetProvider canEdit={canEdit} onBusy={onBusy}>
                    {/* header */}
                    <header className="border-line bg-surface flex items-center gap-4 border-b px-4 py-2.5 sm:px-6">
                      <span className="bg-brand-50 text-brand-500 grid size-9 shrink-0 place-items-center rounded-xl">
                        <Rocket className="size-4.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <D.Title className="text-ink-900 truncate text-base font-semibold tracking-tight">
                          {live ? 'Plant set-up' : `Set up ${plant.name}`}
                        </D.Title>
                        <D.Description className="text-ink-500 truncate text-xs">
                          Type into any cell. Each change saves when you leave the cell.
                        </D.Description>
                      </div>
                      <span
                        aria-live="polite"
                        className={cn(
                          'hidden items-center gap-1.5 text-xs sm:flex',
                          busy.failed ? 'text-danger-600' : busy.pending ? 'text-ink-500' : 'text-success-600',
                        )}
                      >
                        {busy.pending > 0 ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" /> Saving…
                          </>
                        ) : busy.failed ? (
                          <>
                            <TriangleAlert className="size-3.5" /> A change was not saved
                          </>
                        ) : busy.saved ? (
                          <>
                            <Check className="size-3.5" /> All changes saved
                          </>
                        ) : null}
                      </span>
                      <D.Close
                        className="border-line text-ink-500 hover:bg-canvas hover:text-ink-900 grid size-9 shrink-0 place-items-center rounded-full border transition-colors"
                        aria-label="Close"
                      >
                        <X className="size-4" />
                      </D.Close>
                    </header>

                    {/* sheet tabs */}
                    <nav
                      aria-label="Sheets"
                      className="border-line bg-surface scrollbar-none flex gap-1 overflow-x-auto border-b px-3 sm:px-5"
                    >
                      {tabs.map((t) => {
                        const active = t.id === current.id;
                        const bad = t.checks.filter((k) => failing.has(k)).length;
                        const ok = t.checks.length > 0 && items.length > 0 && bad === 0;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'relative flex h-11 shrink-0 items-center gap-2 px-3.5 text-sm font-medium transition-colors',
                              active ? 'text-brand-500' : 'text-ink-500 hover:text-ink-900',
                            )}
                          >
                            <t.icon className="size-4" />
                            {t.label}
                            {!live && bad > 0 && (
                              <span className="bg-danger-500 grid min-w-4.5 place-items-center rounded-full px-1 text-[10px] font-semibold text-white">
                                {bad}
                              </span>
                            )}
                            {!live && ok && <Check className="text-success-600 size-4" />}
                            {active && (
                              <motion.span
                                layoutId="sheet-tab"
                                className="bg-brand-500 absolute inset-x-2 bottom-0 h-0.5 rounded-full"
                                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </nav>

                    {/* the sheet */}
                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={current.id + (emptyPlant ? '-empty' : '')}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <div className="mx-auto w-fit max-w-full min-w-[min(100%,760px)]">{body()}</div>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* footer: what is left, and the one button that matters */}
                    <footer className="border-line bg-surface flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 sm:px-6">
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        {live ? (
                          <span className="text-success-600 flex items-center gap-1.5 text-sm font-medium">
                            <CheckCircle2 className="size-4" /> This plant is live
                          </span>
                        ) : check.isLoading ? null : left.length === 0 ? (
                          <span className="text-success-600 flex items-center gap-1.5 text-sm font-medium">
                            <CheckCircle2 className="size-4" /> Everything is filled in. You can go live.
                          </span>
                        ) : (
                          <>
                            <span className="text-ink-500 text-sm">Still needed:</span>
                            {left.slice(0, 4).map((i) => {
                              const target = tabOfCheck(i.key);
                              return (
                                <button
                                  key={i.key}
                                  type="button"
                                  title={i.message}
                                  onClick={() => target && setTab(target)}
                                  className="bg-danger-50 text-danger-600 hover:bg-danger-100 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                                >
                                  {CHECK_SECTION[i.key]?.label ?? i.key}
                                </button>
                              );
                            })}
                            {left.length > 4 && <span className="text-ink-400 text-xs">+{left.length - 4} more</span>}
                          </>
                        )}
                      </div>
                      {!live && (
                        <Button
                          size="lg"
                          disabled={!canEdit || !check.data?.ready || busy.pending > 0}
                          onClick={() => setConfirm(true)}
                        >
                          <Rocket /> Go live
                        </Button>
                      )}
                    </footer>
                  </SheetProvider>

                  <Modal
                    open={confirm}
                    onOpenChange={(o) => !going && setConfirm(o)}
                    tone="success"
                    icon={<Rocket />}
                    title={`Take ${plant.name} live?`}
                    description="Editors can start filling logsheets and the reports start calculating. The MIS start date can then only move earlier."
                    footer={
                      <>
                        <Button variant="ghost" onClick={() => setConfirm(false)} disabled={going}>
                          Not yet
                        </Button>
                        <Button onClick={goLive} loading={going}>
                          <Rocket /> Go live
                        </Button>
                      </>
                    }
                  />
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
