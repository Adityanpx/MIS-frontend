'use client';

import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/data/stat-card';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { fmtPct } from '@/lib/format';
import type { ParamCard } from '../engine-types';
import { badgeDelta, fmtUnitValue, unitLabel } from '../engine-ui';
import { paramIcon } from './parts';

/** Row 1 of the video: four stat cards — the first three key parameters (today) and revenue. */
export function KpiRow({ cards, plantId }: { cards: ParamCard[]; plantId: string }) {
  const router = useRouter();
  const revenue = cards.find((c) => c.code === 'REVENUE');
  const pick = [...cards.filter((c) => c.code !== 'REVENUE').slice(0, revenue ? 3 : 4), ...(revenue ? [revenue] : [])];
  return (
    <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
      {pick.map((c) => {
        const Icon = paramIcon(c.code);
        const utd = c.utd.pct === null ? null : `UTD ${fmtPct(c.utd.pct * 100, 1, true)}`;
        return (
          <StaggerItem key={c.code}>
            <StatCard
              title={c.code === 'REVENUE' ? 'Revenue today' : `${c.title} today`}
              icon={<Icon />}
              iconTone={c.code === 'REVENUE' ? 'success' : 'brand'}
              value={c.bigNumber}
              format={(n) => fmtUnitValue(n, c.unit)}
              unit={unitLabel(c.unit)}
              delta={badgeDelta(c.mtd)}
              caption={
                <>
                  MTD {fmtUnitValue(c.mtd.value, c.unit)} {unitLabel(c.unit)} vs standard{utd && <> · {utd}</>}
                </>
              }
              spark={c.chart.values}
              onClick={() =>
                router.push(
                  c.code === 'REVENUE' ? `/plants/${plantId}/mis` : `/plants/${plantId}/reports/trend?param=${c.code}`,
                )
              }
            />
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
