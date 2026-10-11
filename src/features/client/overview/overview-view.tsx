'use client';

import { AlertTriangle, ClipboardCheck, Factory, IndianRupee, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { TickGauge } from '@/components/charts/tick-gauge';
import { StatCard } from '@/components/data/stat-card';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState, ProgressBar, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { fmtDate, fmtMillion, fmtNum } from '@/lib/format';
import { AlertItem, alertHref } from '../dashboard/parts';
import { useOverview } from '../engine-queries';
import type { AlertLevel, OverviewPlant } from '../engine-types';
import { badgeDelta } from '../engine-ui';
import { PlantCard } from './plant-card';

type Filter = 'all' | 'attention' | 'live' | 'setup';
const LEVEL_ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };

function greeting(): string {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }).format(new Date()),
  );
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const needsAttention = (p: OverviewPlant) =>
  p.alertCount.critical > 0 ||
  ['missing', 'draft', 'returned'].includes(p.expected.status) ||
  !['active'].includes(p.accountState);

/** Company home (PRD CA-01): portfolio KPIs, one card per plant, submission gauge and the alert feed. */
export function OverviewView() {
  const { profile } = useClientAuth();
  const q = useOverview();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const o = q.data;

  const plants = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (o?.plants ?? []).filter((p) => {
      if (s && !`${p.name} ${p.code} ${p.city ?? ''}`.toLowerCase().includes(s)) return false;
      if (filter === 'attention') return needsAttention(p);
      if (filter === 'live') return p.setupStatus === 'live';
      if (filter === 'setup') return p.setupStatus === 'settings_pending';
      return true;
    });
  }, [o, filter, search]);

  const feed = useMemo(
    () =>
      (o?.plants ?? [])
        .flatMap((p) => p.alerts.map((a) => ({ a, p })))
        .sort((x, y) => LEVEL_ORDER[x.a.level] - LEVEL_ORDER[y.a.level])
        .slice(0, 10),
    [o],
  );

  const t = o?.totals;
  const submittedPct = t && t.expected > 0 ? (t.submitted / t.expected) * 100 : null;
  const first = profile?.user.name.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader
        title={`${greeting()}${first ? `, ${first}` : ''}`}
        subtitle={
          o
            ? `${profile?.tenant.displayName} · logsheets expected for ${fmtDate(o.expectedDate)}`
            : profile?.tenant.displayName
        }
        actions={
          <>
            <div className="w-56">
              <Input
                leading={<Search />}
                placeholder="Find a plant…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10"
              />
            </div>
            <Segmented
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: 'All', count: o?.plants.length },
                { value: 'attention', label: 'Attention', count: o?.plants.filter(needsAttention).length },
                { value: 'live', label: 'Live' },
                { value: 'setup', label: 'Setup' },
              ]}
            />
          </>
        }
      />

      {q.isError && !o && (
        <Card>
          <EmptyState icon={<Factory />} title="The overview could not be loaded" description={errorMessage(q.error)} />
        </Card>
      )}

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
        <StaggerItem>
          <StatCard
            loading={!t}
            title="Plants live"
            icon={<Factory />}
            value={t?.live}
            caption={t && `of ${fmtNum(t.plants)} plants${t.settingsPending ? ` · ${t.settingsPending} in setup` : ''}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            loading={!t}
            title="Logsheets submitted"
            icon={<ClipboardCheck />}
            iconTone="success"
            value={t?.submitted}
            unit={t ? `/ ${t.expected}` : undefined}
            caption={o && `for ${fmtDate(o.expectedDate)}`}
            footer={
              t && (
                <ProgressBar
                  value={t.submitted}
                  max={t.expected || 1}
                  tone={t.submitted < t.expected ? 'warning' : 'success'}
                  height={6}
                />
              )
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            loading={!t}
            title="Critical alerts"
            icon={<AlertTriangle />}
            iconTone={t?.alerts.critical ? 'danger' : 'brand'}
            value={t?.alerts.critical}
            caption={t && `${t.alerts.warning} warnings · ${t.alerts.info} notes`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            loading={!t}
            title="Revenue, month to date"
            icon={<IndianRupee />}
            iconTone="success"
            value={t?.revenueMtd.act}
            format={(n) => fmtMillion(n)}
            delta={badgeDelta(t?.revenueMtd.badge)}
            caption={t && `against ${fmtMillion(t.revenueMtd.std)} standard`}
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div>
          {q.isLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="rounded-card h-[360px]" />
              ))}
            </div>
          ) : plants.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Factory />}
                title={o?.plants.length ? 'No plant matches' : 'No plants yet'}
                description={
                  o?.plants.length
                    ? 'Change the filter or the search.'
                    : 'Plants appear here once the platform team adds them to your account.'
                }
              />
            </Card>
          ) : (
            <Stagger className="grid gap-6 md:grid-cols-2" key={`${filter}-${search}`}>
              {plants.map((p) => (
                <StaggerItem key={p.plantId} className="h-full">
                  <PlantCard p={p} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Submission status"
              subtitle={o ? `Logsheets for ${fmtDate(o.expectedDate)}` : undefined}
              icon={<ClipboardCheck />}
            />
            {t ? (
              <TickGauge
                value={submittedPct}
                tone={
                  submittedPct === null
                    ? 'grey'
                    : submittedPct >= 100
                      ? 'success'
                      : submittedPct >= 50
                        ? 'warning'
                        : 'danger'
                }
                caption={t.expected ? `${t.submitted} of ${t.expected} plants submitted` : 'No plant is due yet'}
                label="Submission status"
              />
            ) : (
              <Skeleton className="rounded-inner mx-auto h-36 w-60" />
            )}
          </Card>
          <Card>
            <CardHeader title="Alerts across plants" subtitle="Most urgent first" icon={<AlertTriangle />} />
            {feed.length === 0 ? (
              <EmptyState
                compact
                title={q.isLoading ? 'Loading…' : 'All clear'}
                description={q.isLoading ? undefined : 'No open alert on the latest data.'}
              />
            ) : (
              <ul className="scrollbar-thin -mx-2 max-h-[460px] space-y-0.5 overflow-y-auto">
                {feed.map(({ a, p }, i) => (
                  <AlertItem
                    key={`${p.plantId}-${a.id}`}
                    alert={a}
                    index={i}
                    plantName={p.code}
                    href={p.reportDate ? alertHref(p.plantId, p.reportDate, a) : undefined}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
