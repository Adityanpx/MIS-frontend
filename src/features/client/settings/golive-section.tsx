'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, FileSpreadsheet, Rocket, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/misc';
import { clientApi } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { Ring } from '../logsheet/blocks';
import { usePlant } from '../plant-context';
import { SectionHeader, useCanEditSettings } from './parts';
import { apiErrors, useSettings, useSettingsWrite } from './queries';
import type { GoLiveCheck } from './types';

/** go-live item → the settings section that fixes it */
export const CHECK_SECTION: Record<string, { section: string; label: string }> = {
  parameters: { section: 'template', label: 'Parameter catalogue' },
  units: { section: 'parameters', label: 'Units' },
  standards: { section: 'parameters', label: 'Standards' },
  lab_limits: { section: 'parameters', label: 'Lab limits' },
  contract_fees: { section: 'contract', label: 'Contract fees' },
  stock_opening: { section: 'stock', label: 'Stock opening balances' },
  cash_opening: { section: 'cash', label: 'Site cash opening' },
  staff: { section: 'staff', label: 'Staff strength' },
  safety: { section: 'safety', label: 'Safety requirements' },
};

/** A checklist row: a page link on the settings page, a step jump inside the guided-setup popup. */
function ItemLink({
  section,
  href,
  onJump,
  className,
  children,
}: {
  section: string;
  href: string;
  onJump?: (section: string) => void;
  className: string;
  children: ReactNode;
}) {
  if (onJump)
    return (
      <button type="button" className={className} onClick={() => onJump(section)}>
        {children}
      </button>
    );
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** §11.12 Go-live checklist (SET-10): every item green → Client Admin takes the plant live. */
export function GoLiveSection({ onJump }: { onJump?: (section: string) => void } = {}) {
  const { plant } = usePlant();
  const q = useSettings('go-live-check');
  const canEdit = useCanEditSettings();
  const qc = useQueryClient();
  const { reloadProfile } = useClientAuth();
  const [confirm, setConfirm] = useState(false);
  const live = plant.setupStatus === 'live';
  const go = useSettingsWrite({
    key: 'go-live-check',
    request: (id) => clientApi.post<GoLiveCheck>(`/plants/${id}/settings/go-live`),
  });
  const base = `/plants/${plant.id}`;

  async function goLive() {
    try {
      await go.mutateAsync(undefined as never);
      setConfirm(false);
      void qc.invalidateQueries({ queryKey: qk.client.plants });
      await reloadProfile();
    } catch (e) {
      apiErrors(e);
    }
  }

  const items = q.data?.items ?? [];
  const ok = items.filter((i) => i.ok).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={live ? 'Plant status' : 'Go-live checklist'}
        description={
          live
            ? 'This plant is live: logsheets are open and reports are calculated every day.'
            : 'Complete every item, then take the plant live. Logsheets, the MIS report and the dashboard open from that moment.'
        }
      />
      {live ? (
        <Card className="relative overflow-hidden">
          <div className="dot-grid-ink absolute inset-y-0 right-0 w-1/2 opacity-40" />
          <div className="relative flex flex-wrap items-center gap-6">
            <motion.span
              initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="bg-success-50 text-success-600 grid size-20 place-items-center rounded-3xl"
            >
              <Rocket className="size-9" />
            </motion.span>
            <div className="min-w-0 flex-1">
              <p className="text-ink-900 text-2xl font-semibold">{plant.name} is live</p>
              <p className="text-ink-500 mt-1 text-sm">
                Settings can still be changed; effective dates keep past reports correct.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" asChild>
                <Link href={`${base}/imports`}>
                  <FileSpreadsheet /> Import history
                </Link>
              </Button>
              <Button asChild>
                <Link href={`${base}/logsheet`}>
                  <ClipboardList /> Open logsheets
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="flex flex-col items-center justify-center text-center">
            {q.isLoading ? (
              <Skeleton className="size-36 rounded-full" />
            ) : (
              <div className="relative grid place-items-center">
                <Ring value={ok} max={items.length || 1} size={150} stroke={12} />
                <div className="absolute text-center">
                  <p className="text-ink-900 tabular text-3xl font-bold">
                    {ok}/{items.length}
                  </p>
                  <p className="text-ink-500 text-xs">complete</p>
                </div>
              </div>
            )}
            <p className="text-ink-700 mt-5 text-sm">
              {q.data?.ready ? 'Everything is ready.' : 'A few settings are still missing.'}
            </p>
            {canEdit && (
              <Button className="mt-4 w-full" size="lg" disabled={!q.data?.ready} onClick={() => setConfirm(true)}>
                <Rocket /> Go live
              </Button>
            )}
          </Card>
          <Card>
            <ul className="space-y-2">
              {(q.isLoading ? Array.from({ length: 9 }, () => null) : items).map((i, n) =>
                i === null ? (
                  <Skeleton key={n} className="h-14 rounded-xl" />
                ) : (
                  <motion.li
                    key={i.key}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: n * 0.04 }}
                  >
                    <ItemLink
                      section={CHECK_SECTION[i.key]?.section ?? 'general'}
                      href={`${base}/settings/${CHECK_SECTION[i.key]?.section ?? 'general'}`}
                      onJump={onJump}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                        i.ok ? 'border-line hover:bg-canvas' : 'border-danger-100 bg-danger-50/50 hover:bg-danger-50',
                      )}
                    >
                      {i.ok ? (
                        <CheckCircle2 className="text-success-600 size-5" />
                      ) : (
                        <XCircle className="text-danger-500 size-5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-ink-900 text-sm font-semibold">{CHECK_SECTION[i.key]?.label ?? i.key}</p>
                        {!i.ok && <p className="text-danger-600 text-xs">{i.message}</p>}
                      </div>
                      <ArrowRight className="text-ink-300 group-hover:text-ink-700 size-4 transition-colors" />
                    </ItemLink>
                  </motion.li>
                ),
              )}
            </ul>
          </Card>
        </div>
      )}
      <Modal
        open={confirm}
        onOpenChange={(o) => !go.isPending && setConfirm(o)}
        tone="success"
        icon={<Rocket />}
        title={`Take ${plant.name} live?`}
        description="Editors can start filling logsheets and the reports start calculating. The MIS start date can then only move earlier."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Not yet
            </Button>
            <Button onClick={goLive} loading={go.isPending}>
              <Rocket /> Go live
            </Button>
          </>
        }
      />
    </div>
  );
}
