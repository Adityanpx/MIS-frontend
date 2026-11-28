'use client';

import { AlertTriangle, ClipboardCheck, Download, Factory, IndianRupee, LayoutGrid } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { DateNav } from '@/components/date/date-nav';
import { StatCard } from '@/components/data/stat-card';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ProgressBar, Spinner } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { todayIST } from '@/lib/dates';
import { fmtDate, fmtMillion, fmtPct } from '@/lib/format';
import { IssuesPanel } from './issues-panel';
import { STANDARD_LABEL } from './portfolio-ui';
import { PortfolioTable } from './portfolio-table';
import { usePortfolio, usePortfolioExport } from './queries';

type StandardParam = 'primary' | 'actual' | 'bidding';
const isIsoDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Company Portfolio (MGT-11): every plant on one screen for one date — KPI strip, the system-detected issues
 * grouped by plant, and one row per plant across the five MIS areas. Client Admin and Management (read-only).
 */
export function PortfolioView() {
  const auth = useClientAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const profile = auth.profile;
  const allowed = !!profile && (profile.user.isClientAdmin || profile.user.isManagement);

  useEffect(() => {
    if (auth.status === 'authenticated' && profile && !allowed) router.replace('/');
  }, [auth.status, profile, allowed, router]);

  const today = todayIST();
  const rawDate = sp.get('date');
  const date = isIsoDate(rawDate) && rawDate <= today ? rawDate : today;
  const rawStd = sp.get('standard');
  const standard: StandardParam = rawStd === 'actual' || rawStd === 'bidding' ? rawStd : 'primary';

  const q = usePortfolio(date, standard);
  const exportM = usePortfolioExport();
  const d = q.data;
  const s = d?.summary;
  const loading = q.isLoading || !allowed;

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  const submittedPct = s && s.logsheets.expected > 0 ? (s.logsheets.submitted / s.logsheets.expected) * 100 : null;
  const revPct = s?.revenueMtd && s.revenueMtd.std !== 0 ? (s.revenueMtd.act / s.revenueMtd.std) * 100 : null;

  return (
    <>
      <PageHeader
        title="Portfolio"
        badge={
          q.isFetching && !q.isLoading ? (
            <Spinner className="size-4" />
          ) : profile?.user.isManagement ? (
            <Badge tone="neutral" size="sm">
              Read-only
            </Badge>
          ) : null
        }
        subtitle={
          s
            ? `${s.plants} plant${s.plants === 1 ? '' : 's'} · ${fmtDate(date)} · ${STANDARD_LABEL[standard]}`
            : `${fmtDate(date)} · ${STANDARD_LABEL[standard]}`
        }
        actions={
          <>
            <div className="w-44">
              <Select
                aria-label="Standard"
                value={standard}
                onValueChange={(v) => update({ standard: v === 'primary' ? null : v })}
                options={[
                  { value: 'primary', label: 'Primary standard' },
                  { value: 'actual', label: 'Actual' },
                  { value: 'bidding', label: 'Bidding' },
                ]}
              />
            </div>
            <DateNav value={date} max={today} onChange={(v) => update({ date: v === today ? null : v })} />
            <Button
              variant="secondary"
              loading={exportM.isPending}
              disabled={exportM.isPending || !d}
              onClick={() => exportM.mutate({ date, standard })}
            >
              {!exportM.isPending && <Download className="size-4" />}
              Export Excel
            </Button>
          </>
        }
      />

      {q.isError && !d ? (
        <Card>
          <EmptyState
            icon={<LayoutGrid />}
            title="The portfolio could not be loaded"
            description={errorMessage(q.error)}
            action={
              <Button variant="secondary" onClick={() => void q.refetch()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            <StaggerItem>
              <StatCard
                loading={loading}
                title="Plants live"
                icon={<Factory />}
                value={s?.live}
                unit={s ? `/ ${s.plants}` : undefined}
                caption={
                  s &&
                  (s.issues.plantsAffected > 0
                    ? `${s.issues.plantsAffected} need${s.issues.plantsAffected === 1 ? 's' : ''} attention`
                    : 'All plants on track')
                }
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                loading={loading}
                title="Logsheets submitted"
                icon={<ClipboardCheck />}
                iconTone={s && s.logsheets.missing > 0 ? 'warning' : 'success'}
                value={s?.logsheets.submitted}
                unit={s ? `/ ${s.logsheets.expected}` : undefined}
                caption={
                  s &&
                  (s.logsheets.expected === 0
                    ? `None due for ${fmtDate(date)}`
                    : [
                        s.logsheets.missing && `${s.logsheets.missing} missing`,
                        s.logsheets.draft && `${s.logsheets.draft} draft`,
                        s.logsheets.returned && `${s.logsheets.returned} returned`,
                      ]
                        .filter(Boolean)
                        .join(' · ') || `All in for ${fmtDate(date)}`)
                }
                footer={
                  s &&
                  submittedPct !== null && (
                    <ProgressBar value={submittedPct} tone={submittedPct < 100 ? 'warning' : 'success'} height={6} />
                  )
                }
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                loading={loading}
                title="Critical issues"
                icon={<AlertTriangle />}
                iconTone={s?.issues.critical ? 'danger' : 'success'}
                value={s?.issues.critical}
                caption={
                  s &&
                  `${s.issues.warning} warning${s.issues.warning === 1 ? '' : 's'}${
                    s.outletExceededPlants ? ` · ${s.outletExceededPlants} outlet breach` : ''
                  }${s.breakdowns.critical ? ` · ${s.breakdowns.critical} critical breakdown` : ''}`
                }
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                loading={loading}
                title="Revenue, month to date"
                icon={<IndianRupee />}
                iconTone="success"
                value={s?.revenueMtd?.act ?? null}
                format={(n) => fmtMillion(n)}
                delta={revPct !== null ? { value: revPct - 100, colour: revPct >= 100 ? 'green' : 'red' } : undefined}
                caption={
                  s &&
                  (s.revenueMtd
                    ? `${fmtPct(revPct, 1)} of ${fmtMillion(s.revenueMtd.std)} standard`
                    : 'No revenue data for this date')
                }
              />
            </StaggerItem>
          </Stagger>

          <IssuesPanel
            issues={d?.issues ?? []}
            rows={d?.rows ?? []}
            date={date}
            isClientAdmin={!!profile?.user.isClientAdmin}
            loading={loading}
          />

          <PortfolioTable
            rows={d?.rows ?? []}
            summary={s}
            loading={loading}
            onOpen={(plantId) => router.push(`/plants/${plantId}/dashboard/${date}`)}
          />
        </div>
      )}
    </>
  );
}
