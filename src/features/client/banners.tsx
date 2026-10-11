'use client';

import { AlertOctagon, AlertTriangle, Clock, Eye, LifeBuoy, PencilLine } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useClientAuth } from '@/lib/auth/client-auth';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePlantIdParam } from './plant-context';
import { useBanners } from './queries';

const LEVEL = {
  yellow: { box: 'border-yellow-500/30 bg-yellow-50 text-ink-900', icon: 'text-yellow-500', Icon: Clock },
  orange: { box: 'border-warning-100 bg-warning-50 text-ink-900', icon: 'text-warning-500', Icon: AlertTriangle },
  red: { box: 'border-danger-100 bg-danger-50 text-ink-900', icon: 'text-danger-500', Icon: AlertOctagon },
} as const;

/**
 * PRD §9.2 lifecycle banners (grace → read-only → suspended → terminated, expired).
 * Text comes from GET /banners (already role-aware: non-admins see "contact your administrator").
 * On a plant page only that plant's banner is shown; elsewhere all of them (max 2 + "N more").
 */
export function LifecycleBanners() {
  const { data } = useBanners();
  const plantId = usePlantIdParam();
  const [expanded, setExpanded] = useState(false);
  const list = (data ?? []).filter((b) => !plantId || b.plantId === plantId);
  const shown = expanded ? list : list.slice(0, 2);
  if (list.length === 0) return null;
  return (
    <div className="no-print space-y-2 px-4 pt-4 sm:px-6 lg:px-8">
      <AnimatePresence initial={false}>
        {shown.map((b) => {
          const l = LEVEL[b.level] ?? LEVEL.orange;
          return (
            <motion.div
              key={b.plantId}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              role={b.level === 'red' ? 'alert' : 'status'}
              className={cn('flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center', l.box)}
            >
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl bg-white/70', l.icon)}>
                <l.Icon className="size-[18px]" />
              </span>
              <div className="min-w-0 flex-1 text-[13px] leading-relaxed">
                {!plantId && <span className="mr-1.5 font-semibold">{b.plantName}:</span>}
                <span className="text-ink-700">{b.message}</span>
                {b.nextChange && (
                  <span className="text-ink-500 ml-1.5">
                    (changes to {b.nextChange.state.replace('_', '-')} on {fmtDate(b.nextChange.on)})
                  </span>
                )}
              </div>
              {b.showPayNow && (
                <Link
                  href="/billing/invoices?status=overdue"
                  className="bg-brand-500 hover:bg-brand-600 inline-flex h-9 shrink-0 items-center justify-center rounded-full px-4 text-[13px] font-medium text-white"
                >
                  Pay now
                </Link>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {list.length > 2 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-brand-500 text-xs font-medium hover:underline"
        >
          {expanded ? 'Show less' : `+${list.length - 2} more plant notices`}
        </button>
      )}
    </div>
  );
}

function useCountdown(until: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return '';
  const s = Math.max(0, Math.round((until - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** TRD §7.7: permanent purple strip while a Super Admin is acting as this client. */
export function ActAsBanner() {
  const auth = useClientAuth();
  const left = useCountdown(auth.actAsExpiresAt);
  const acting = auth.profile?.actingAs;
  if (!auth.isActingAs || !acting) return null;
  return (
    <div className="no-print sticky top-[72px] z-20 flex flex-wrap items-center gap-x-3 gap-y-1 bg-linear-to-r from-purple-600 to-purple-500 px-4 py-2 text-[13px] text-white sm:px-6 lg:px-8">
      <LifeBuoy className="size-4" />
      <span className="font-semibold">Support session</span>
      <span className="text-white/85">
        Super Admin viewing <b className="font-semibold text-white">{auth.profile?.tenant.displayName}</b> as{' '}
        {auth.profile?.user.name}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-medium">
        {acting.mode === 'view' ? <Eye className="size-3.5" /> : <PencilLine className="size-3.5" />}
        {acting.mode === 'view' ? 'Read-only' : 'Can edit'}
      </span>
      <span className="tabular ml-auto text-white/85">ends in {left}</span>
      <button
        type="button"
        onClick={() => {
          void auth.logout('act_as_ended');
          window.close();
        }}
        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-purple-600 hover:bg-purple-50"
      >
        Exit
      </button>
    </div>
  );
}
