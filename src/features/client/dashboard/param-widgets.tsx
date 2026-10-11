'use client';

import { useRouter } from 'next/navigation';
import { HoverLift, Stagger, StaggerItem } from '@/components/motion/primitives';
import { CountUp } from '@/components/motion/count-up';
import { Sparkline } from '@/components/charts/sparkline';
import { C } from '@/components/charts/theme';
import { Badge, DeltaPill } from '@/components/ui/badge';
import { Card, CardHeader, CardMenu } from '@/components/ui/card';
import { DataTable } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ParamCard, QualityCard } from '../engine-types';
import { badgeDelta, fmtUnitValue, unitLabel } from '../engine-ui';
import { CardMiniChart, EventsChip, RangeBar, paramIcon } from './parts';

function PeriodRow({
  label,
  value,
  unit,
  badge,
}: {
  label: string;
  value: number | null;
  unit: string;
  badge: ParamCard['mtd'];
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-ink-400 text-[11px] font-medium tracking-wider uppercase">{label}</span>
      <span className="flex items-center gap-2">
        <span className="text-ink-900 tabular text-sm font-semibold">{fmtUnitValue(value, unit)}</span>
        <DeltaPill {...(badgeDelta(badge) ?? { value: null })} />
      </span>
    </div>
  );
}

/** The MIS dashboard parameter card: today, MTD and UTD with the API's badge colours, events and the 5-month chart. */
export function ParamCardView({ card, onOpen }: { card: ParamCard; onOpen?: () => void }) {
  const Icon = paramIcon(card.code);
  return (
    <HoverLift className="h-full">
      <Card className="flex h-full flex-col" interactive={!!onOpen} onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink-700 truncate text-sm font-medium">{card.title}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-ink-900 text-[28px] leading-none font-semibold tracking-tight">
                <CountUp value={card.bigNumber} format={(n) => fmtUnitValue(n, card.unit)} />
              </span>
              <span className="text-ink-500 text-xs font-medium">{unitLabel(card.unit)} today</span>
            </p>
          </div>
          <span className="bg-brand-50 text-brand-500 grid size-9 shrink-0 place-items-center rounded-xl">
            <Icon className="size-[18px]" />
          </span>
        </div>
        <div className="divide-line mt-3 divide-y divide-dashed">
          <PeriodRow label="MTD" value={card.mtd.value} unit={card.unit} badge={card.mtd} />
          <PeriodRow label="UTD" value={card.utd.value} unit={card.unit} badge={card.utd} />
        </div>
        <div className="mt-2">
          <EventsChip events={card.events} />
        </div>
        <div className="-mx-1 mt-auto pt-4">
          <p className="text-ink-400 mb-1 px-1 text-[10px] font-medium tracking-wider uppercase">{card.chart.title}</p>
          <CardMiniChart chart={card.chart} unit={card.unit} height={110} />
        </div>
      </Card>
    </HoverLift>
  );
}

export function ParamCardsGrid({ cards, plantId }: { cards: ParamCard[]; plantId: string }) {
  const router = useRouter();
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-ink-900 text-lg font-semibold tracking-tight">Key parameters</h2>
          <p className="text-ink-500 text-xs">
            Badges compare against the standard: blue = favourable, red = unfavourable.
          </p>
        </div>
      </div>
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3 2xl:grid-cols-4">
        {cards.map((c) => (
          <StaggerItem key={c.code} className="h-full">
            <ParamCardView
              card={c}
              onOpen={() =>
                router.push(
                  c.code === 'REVENUE' ? `/plants/${plantId}/mis` : `/plants/${plantId}/reports/trend?param=${c.code}`,
                )
              }
            />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

/** "Best Selling Products" table → chemicals: today, MTD and UTD with badges, events, 5-month sparkline. */
export function ChemicalsCard({ cards, plantId }: { cards: ParamCard[]; plantId: string }) {
  const router = useRouter();
  return (
    <Card>
      <CardHeader
        title="Chemicals"
        subtitle="Consumption against standard"
        action={
          <CardMenu
            items={[
              { label: 'Open stock ledger', onSelect: () => router.push(`/plants/${plantId}/reports/stock-ledger`) },
            ]}
          />
        }
      />
      <DataTable
        rows={cards}
        rowKey={(r) => r.code}
        onRowClick={(r) => router.push(`/plants/${plantId}/reports/trend?param=${r.code}`)}
        columns={[
          {
            key: 'name',
            header: 'Chemical',
            cell: (r) => {
              const Icon = paramIcon(r.code);
              return (
                <span className="flex items-center gap-3">
                  <span className="border-line bg-canvas text-ink-500 grid size-8 shrink-0 place-items-center rounded-lg border">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-ink-900 block truncate font-medium">{r.title}</span>
                    <span className="text-ink-400 text-xs">{r.unit}</span>
                  </span>
                </span>
              );
            },
          },
          { key: 'today', header: 'Today', align: 'right', cell: (r) => fmtUnitValue(r.bigNumber, r.unit) },
          {
            key: 'mtd',
            header: 'MTD',
            align: 'right',
            cell: (r) => (
              <span className="inline-flex items-center gap-2">
                {fmtUnitValue(r.mtd.value, r.unit)}
                <DeltaPill {...(badgeDelta(r.mtd) ?? { value: null })} />
              </span>
            ),
          },
          {
            key: 'utd',
            header: 'UTD',
            align: 'right',
            hideBelow: 'lg',
            cell: (r) => fmtUnitValue(r.utd.value, r.unit),
          },
          {
            key: 'events',
            header: 'Events',
            align: 'right',
            hideBelow: 'md',
            cell: (r) => (
              <span className={cn('font-medium', r.events.flag === 'bad' ? 'text-danger-600' : 'text-ink-500')}>
                {r.events.mtd}
              </span>
            ),
          },
          {
            key: 'trend',
            header: '5 months',
            width: '110px',
            hideBelow: 'sm',
            cell: (r) => (
              <div className="w-24">
                <Sparkline values={r.chart.values} height={30} color={r.events.flag === 'bad' ? C.warning : C.brand} />
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}

/** Treated-water quality: one card per outlet parameter with the limit band, result chip and 5-month cone chart. */
export function QualityGrid({ cards }: { cards: QualityCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-ink-900 text-lg font-semibold tracking-tight">Treated water quality</h2>
        <p className="text-ink-500 text-xs">Outlet results on the report date against their limits.</p>
      </div>
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3 2xl:grid-cols-5">
        {cards.map((q) => {
          const bad = q.resultFlag === 'bad';
          const limit = [
            q.min !== null ? `≥ ${fmtUnitValue(q.min, q.unit)}` : null,
            q.max !== null ? `≤ ${fmtUnitValue(q.max, q.unit)}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <StaggerItem key={q.code} className="h-full">
              <Card className={cn('flex h-full flex-col', bad && 'border-danger-100')}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-ink-700 truncate text-sm font-medium">{q.title}</p>
                  {q.result && (
                    <Badge tone={bad ? 'danger' : 'success'} size="sm" dot>
                      {bad ? 'Exceeded' : 'Within limit'}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-ink-900 text-[28px] leading-none font-semibold tracking-tight">
                    <CountUp value={q.bigNumber} format={(n) => fmtUnitValue(n, q.unit)} />
                  </span>
                  <span className="text-ink-500 text-xs">{q.unit}</span>
                </p>
                <div className="mt-4">
                  <RangeBar value={q.bigNumber} min={q.min} max={q.max} bad={bad} />
                </div>
                <div className="text-ink-500 mt-2 flex items-center justify-between text-[11px]">
                  <span>Limit {limit || '—'}</span>
                  <EventsChip events={q.events} />
                </div>
                <div className="-mx-1 mt-auto pt-4">
                  <CardMiniChart chart={q.chart} unit={q.unit} height={100} reference={q.max} />
                </div>
              </Card>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
