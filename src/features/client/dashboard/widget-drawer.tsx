'use client';

import { ArrowDown, ArrowUp, Check, Plus, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { DASHBOARD_WIDGETS, type DashboardWidgetId } from '@/shared/schemas/dashboard';
import { WidgetPreview } from './previews';
import { WIDGETS } from './widgets';

/**
 * The video's "Add Widget" drawer. Top: the widgets on this dashboard in order (move up/down, remove).
 * Below: every widget not on the dashboard as a preview card with a #tag and a blue "Add" pill.
 * Every change applies immediately and is saved per user + plant (PUT /dashboard/layout).
 */
export function WidgetDrawer({
  open,
  onOpenChange,
  widgets,
  onChange,
  onReset,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  widgets: DashboardWidgetId[];
  onChange: (w: DashboardWidgetId[]) => void;
  onReset: () => void;
  readOnly?: boolean;
}) {
  const hidden = DASHBOARD_WIDGETS.filter((w) => !widgets.includes(w));
  const move = (i: number, d: -1 | 1) => {
    const next = [...widgets];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      width="md"
      title="Customize dashboard"
      description={readOnly ? 'Changes are not saved during a support session.' : 'Saved for you, on this plant only.'}
      footer={
        <>
          <Button variant="ghost" onClick={onReset}>
            <RotateCcw />
            Reset to default
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            <Check />
            Done
          </Button>
        </>
      }
    >
      <p className="text-ink-400 mb-2 text-[11px] font-medium tracking-wider uppercase">
        On your dashboard · {widgets.length}
      </p>
      <ul className="space-y-1.5">
        <AnimatePresence initial={false}>
          {widgets.map((id, i) => {
            const w = WIDGETS[id];
            return (
              <motion.li
                key={id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                className="border-line bg-surface flex items-center gap-3 rounded-2xl border p-2 pr-2.5"
              >
                <span className="bg-muted-bg grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-xl [&_svg]:h-10 [&_svg]:w-14">
                  <WidgetPreview kind={w.preview} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink-900 block truncate text-sm font-semibold">{w.title}</span>
                  <span className="text-ink-500 text-xs">
                    {w.span === 'full' ? 'Full width' : w.span === 'main' ? 'Wide column' : 'Side column'}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="text-ink-500 hover:bg-canvas hover:text-ink-900 grid size-8 place-items-center rounded-full disabled:opacity-30"
                    aria-label={`Move ${w.title} up`}
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === widgets.length - 1}
                    onClick={() => move(i, 1)}
                    className="text-ink-500 hover:bg-canvas hover:text-ink-900 grid size-8 place-items-center rounded-full disabled:opacity-30"
                    aria-label={`Move ${w.title} down`}
                  >
                    <ArrowDown className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(widgets.filter((x) => x !== id))}
                    className="text-ink-500 hover:bg-danger-50 hover:text-danger-600 grid size-8 place-items-center rounded-full"
                    aria-label={`Remove ${w.title}`}
                  >
                    <X className="size-4" />
                  </button>
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <p className="text-ink-400 mt-8 mb-3 text-[11px] font-medium tracking-wider uppercase">Add widget</p>
      {hidden.length === 0 ? (
        <div className="border-line text-ink-500 rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
          Every widget is already on your dashboard.
        </div>
      ) : (
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {hidden.map((id, i) => {
              const w = WIDGETS[id];
              return (
                <motion.li
                  key={id}
                  layout
                  initial={{ opacity: 0, scale: 0.96, rotate: -1.5 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 380, damping: 30 }}
                  whileHover={{ y: -2, boxShadow: '0 12px 32px rgb(16 24 40 / 0.10)' }}
                  className="border-line bg-surface flex gap-4 rounded-3xl border p-4"
                >
                  <span className="bg-muted-bg grid size-24 shrink-0 place-items-center rounded-2xl">
                    <WidgetPreview kind={w.preview} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-ink-900 text-[15px] font-semibold">{w.title}</span>
                    <span className="text-ink-500 mt-1 text-[13px] leading-relaxed">{w.description}</span>
                    <span className="mt-auto flex items-center justify-between pt-3">
                      <Badge shape="tag" tone="neutral">
                        #{w.tag}
                      </Badge>
                      <Button size="sm" onClick={() => onChange([...widgets, id])}>
                        <Plus />
                        Add
                      </Button>
                    </span>
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Drawer>
  );
}
