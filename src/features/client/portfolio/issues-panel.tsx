'use client';

import { AlertTriangle, ArrowUpRight, ChevronRight, CircleCheckBig, OctagonAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { IssueCategory, IssueLevel, PortfolioIssue, PortfolioRow } from '../engine-types';
import { CATEGORY_META, CATEGORY_ORDER, HEALTH_META, canOpenPlant, issueHref } from './portfolio-ui';

type LevelFilter = 'all' | IssueLevel;
const PLANTS_COLLAPSED = 5;

interface PlantGroup {
  plantId: string;
  plantName: string;
  plantCode: string;
  critical: number;
  warning: number;
  items: PortfolioIssue[];
}

/** Every system-detected issue across the company, grouped by plant (most critical plant first). */
export function IssuesPanel({
  issues,
  rows,
  date,
  isClientAdmin,
  loading,
}: {
  issues: PortfolioIssue[];
  rows: PortfolioRow[];
  date: string;
  isClientAdmin: boolean;
  loading: boolean;
}) {
  const [level, setLevel] = useState<LevelFilter>('all');
  const [category, setCategory] = useState<IssueCategory | 'all'>('all');
  const [expanded, setExpanded] = useState(false);

  const byLevel = useMemo(() => (level === 'all' ? issues : issues.filter((i) => i.level === level)), [issues, level]);
  const categoryCounts = useMemo(() => {
    const m = new Map<IssueCategory, number>();
    for (const i of byLevel) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [byLevel]);
  const activeCategory = category !== 'all' && categoryCounts.has(category) ? category : 'all';
  const visible = activeCategory === 'all' ? byLevel : byLevel.filter((i) => i.category === activeCategory);

  const groups = useMemo(() => {
    const m = new Map<string, PlantGroup>();
    for (const i of visible) {
      const g = m.get(i.plantId) ?? {
        plantId: i.plantId,
        plantName: i.plantName,
        plantCode: i.plantCode,
        critical: 0,
        warning: 0,
        items: [],
      };
      g.items.push(i);
      g[i.level] += 1;
      m.set(i.plantId, g);
    }
    return [...m.values()].sort(
      (a, b) => b.critical - a.critical || b.warning - a.warning || a.plantName.localeCompare(b.plantName),
    );
  }, [visible]);

  const rowById = useMemo(() => new Map(rows.map((r) => [r.plantId, r])), [rows]);
  const critical = issues.filter((i) => i.level === 'critical').length;
  const warning = issues.length - critical;
  const plantsAffected = new Set(issues.map((i) => i.plantId)).size;
  const shown = expanded ? groups : groups.slice(0, PLANTS_COLLAPSED);

  return (
    <Card>
      <CardHeader
        icon={issues.length > 0 ? <AlertTriangle /> : <CircleCheckBig />}
        title="Issues"
        subtitle={
          loading
            ? 'Checking every plant…'
            : issues.length === 0
              ? 'Nothing needs attention'
              : `${critical} critical · ${warning} warning${warning === 1 ? '' : 's'} · ${plantsAffected} plant${plantsAffected === 1 ? '' : 's'} affected`
        }
        action={
          issues.length > 0 && (
            <Segmented
              size="sm"
              value={level}
              onChange={setLevel}
              items={[
                { value: 'all', label: 'All', count: issues.length },
                { value: 'critical', label: 'Critical', count: critical },
                { value: 'warning', label: 'Warnings', count: warning },
              ]}
            />
          )
        }
      />

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="rounded-inner h-20 w-full" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState
          compact
          icon={<CircleCheckBig />}
          title="All plants are on track"
          description="No missing logsheets, limit breaches, low stock, expiring registers or critical breakdowns for this date."
        />
      ) : (
        <>
          {/* area filter */}
          <div className="mb-4 flex flex-wrap gap-2">
            <CategoryChip
              label="All areas"
              count={byLevel.length}
              active={activeCategory === 'all'}
              onClick={() => setCategory('all')}
            />
            {CATEGORY_ORDER.filter((c) => categoryCounts.has(c)).map((c) => {
              const Icon = CATEGORY_META[c].icon;
              return (
                <CategoryChip
                  key={c}
                  icon={<Icon />}
                  label={CATEGORY_META[c].label}
                  count={categoryCounts.get(c) ?? 0}
                  active={activeCategory === c}
                  onClick={() => setCategory(activeCategory === c ? 'all' : c)}
                />
              );
            })}
          </div>

          {groups.length === 0 ? (
            <EmptyState compact title="No issues match" description="Change the severity or area filter." />
          ) : (
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {shown.map((g) => {
                  const row = rowById.get(g.plantId);
                  const health = HEALTH_META[g.critical > 0 ? 'critical' : 'warning'];
                  const open = row && canOpenPlant(row);
                  return (
                    <motion.section
                      key={g.plantId}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="rounded-inner border-line overflow-hidden border"
                    >
                      <header className="bg-canvas/60 border-line flex items-center justify-between gap-3 border-b px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={cn('size-2.5 shrink-0 rounded-full ring-4', health.dot, health.ring)} />
                          <span className="text-ink-900 truncate text-sm font-semibold">{g.plantName}</span>
                          <span className="text-ink-400 hidden text-xs sm:inline">{g.plantCode}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {g.critical > 0 && (
                            <Badge tone="danger" size="sm">
                              {g.critical} critical
                            </Badge>
                          )}
                          {g.warning > 0 && (
                            <Badge tone="warning" size="sm">
                              {g.warning} warning{g.warning === 1 ? '' : 's'}
                            </Badge>
                          )}
                          {open && (
                            <Link
                              href={`/plants/${g.plantId}/dashboard/${date}`}
                              className="text-ink-500 hover:text-brand-500 ml-1 inline-flex items-center gap-0.5 text-xs font-medium"
                            >
                              Open <ArrowUpRight className="size-3.5" />
                            </Link>
                          )}
                        </div>
                      </header>
                      <ul className="divide-line divide-y divide-dashed">
                        {g.items.map((i) => (
                          <IssueItem key={i.id} issue={i} href={issueHref(i, date, isClientAdmin)} />
                        ))}
                      </ul>
                    </motion.section>
                  );
                })}
              </AnimatePresence>
              {groups.length > PLANTS_COLLAPSED && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-brand-500 hover:bg-brand-50 w-full rounded-full py-2 text-sm font-medium transition-colors"
                >
                  {expanded ? 'Show fewer plants' : `Show all ${groups.length} plants`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors [&_svg]:size-3.5',
        active
          ? 'border-ink-900 bg-ink-900 text-white'
          : 'border-line bg-surface text-ink-600 hover:border-ink-200 hover:text-ink-900',
      )}
    >
      {icon}
      {label}
      <span
        className={cn('tabular rounded-full px-1.5 text-[11px]', active ? 'bg-white/15' : 'bg-muted-bg text-ink-500')}
      >
        {count}
      </span>
    </button>
  );
}

function IssueItem({ issue, href }: { issue: PortfolioIssue; href: string | null }) {
  const critical = issue.level === 'critical';
  const Area = CATEGORY_META[issue.category].icon;
  const body = (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4',
          critical ? 'bg-danger-50 text-danger-600' : 'bg-warning-50 text-warning-600',
        )}
      >
        {critical ? <OctagonAlert /> : <AlertTriangle />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-ink-900 text-sm font-medium">{issue.title}</p>
        <p className="text-ink-500 mt-0.5 text-xs leading-relaxed">{issue.detail}</p>
      </div>
      <span className="text-ink-400 hidden shrink-0 items-center gap-1 text-[11px] font-medium sm:inline-flex [&_svg]:size-3.5">
        <Area />
        {CATEGORY_META[issue.category].label}
      </span>
      {href && (
        <ChevronRight className="text-ink-300 group-hover:text-ink-700 mt-1.5 size-4 shrink-0 transition-colors" />
      )}
    </div>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="group hover:bg-canvas/70 block transition-colors">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}
