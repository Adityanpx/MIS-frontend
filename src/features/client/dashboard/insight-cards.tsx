'use client';

import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { TickGauge } from '@/components/charts/tick-gauge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Segmented } from '@/components/ui/tabs';
import { fmtNum } from '@/lib/format';
import type { DashboardSummary, PlantAlert } from '../engine-types';
import { AlertItem, alertHref } from './parts';

/** "Today's alerts" — replaces the video's AI Assistant card (decided). Derived from engine flags by the API. */
export function AlertsCard({ alerts, plantId, date }: { alerts: PlantAlert[]; plantId: string; date: string }) {
  const critical = alerts.filter((a) => a.level === 'critical').length;
  return (
    <Card>
      <CardHeader
        title="Today’s alerts"
        subtitle={
          alerts.length ? `${alerts.length} item${alerts.length > 1 ? 's' : ''} need a look` : 'Report date checks'
        }
        action={
          alerts.length > 0 && (
            <Badge tone={critical ? 'danger' : 'warning'} size="md">
              {critical ? `${critical} critical` : alerts.length}
            </Badge>
          )
        }
      />
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="bg-orb grid size-16 place-items-center rounded-full text-white"
          >
            <CheckCircle2 className="size-7" />
          </motion.span>
          <p className="text-ink-900 mt-4 text-sm font-semibold">All clear</p>
          <p className="text-ink-500 mt-1 max-w-56 text-xs">
            No lab exceedance, stock, cash, staff or safety issue on this date.
          </p>
        </div>
      ) : (
        <ul className="scrollbar-thin -mx-2 max-h-[340px] space-y-0.5 overflow-y-auto">
          {alerts.map((a, i) => (
            <AlertItem key={a.id} alert={a} index={i} href={alertHref(plantId, date, a)} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Outlet compliance gauge (video: "Repeat Customer Rate"). Green ≥ 95 %, orange ≥ 85 %, red below. */
export function ComplianceCard({ summary, plantId }: { summary: DashboardSummary; plantId: string }) {
  const [period, setPeriod] = useState<'mtd' | 'utd'>('mtd');
  const c = summary.compliance;
  const pct = period === 'mtd' ? c.mtdPct : c.utdPct;
  const exc = period === 'mtd' ? c.exceedancesMtd : c.exceedancesUtd;
  const tests = period === 'mtd' ? c.testsMtd : c.testsUtd;
  const tone = pct === null ? 'grey' : pct >= 95 ? 'success' : pct >= 85 ? 'warning' : 'danger';
  return (
    <Card>
      <CardHeader
        title="Outlet compliance"
        icon={<ShieldCheck />}
        action={
          <Segmented
            size="sm"
            value={period}
            onChange={setPeriod}
            items={[
              { value: 'mtd', label: 'MTD' },
              { value: 'utd', label: 'UTD' },
            ]}
          />
        }
      />
      <TickGauge
        key={period}
        value={pct}
        tone={tone}
        target={100}
        label="Outlet compliance"
        caption={
          tests ? `${fmtNum(exc)} exceedance${exc === 1 ? '' : 's'} in ${fmtNum(tests)} tests` : 'No lab results yet'
        }
        action={
          <Button asChild size="sm" variant="secondary">
            <Link href={`/plants/${plantId}/reports/lab-compliance`}>Show details</Link>
          </Button>
        }
      />
      {c.failingToday > 0 && (
        <p className="bg-danger-50 text-danger-600 mt-3 rounded-xl px-3 py-2 text-center text-xs font-medium">
          {c.failingToday} of {c.parameters} outlet parameters exceeded today
        </p>
      )}
    </Card>
  );
}
