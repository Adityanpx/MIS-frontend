'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { DateNav } from '@/components/date/date-nav';
import { PageHeader } from '@/components/shell/page-header';
import { todayIST } from '@/lib/dates';
import { useClientAuth } from '@/lib/auth/client-auth';
import type { StandardKind } from '../engine-types';
import { ExceptionsPanel } from './exceptions-panel';
import { PortfolioTable } from './portfolio-table';
import { usePortfolio, usePortfolioExport } from './queries';

export function PortfolioView() {
  const auth = useClientAuth();
  const router = useRouter();
  const sp = useSearchParams();

  // Guard: only Management and Client Admin can view portfolio
  useEffect(() => {
    const p = auth.profile;
    if (auth.status === 'authenticated' && p && !p.user.isManagement && !p.user.isClientAdmin) {
      router.replace('/');
    }
  }, [auth, router]);

  const date = sp.get('date') ?? todayIST();
  const standard = (sp.get('standard') ?? 'primary') as StandardKind | 'primary';
  const [exceptionsOnly, setExceptionsOnly] = useState(sp.get('exc') === '1');

  const q = usePortfolio(date, standard);
  const exportM = usePortfolioExport();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`?${next.toString()}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        subtitle={
          q.data
            ? `${q.data.rows.length} plant${q.data.rows.length !== 1 ? 's' : ''} · ${date}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={standard}
              onValueChange={(v) => update({ standard: v })}
              options={[
                { value: 'primary', label: 'Primary standard' },
                { value: 'actual', label: 'Actual' },
                { value: 'bidding', label: 'Bidding' },
              ]}
            />
            <DateNav value={date} onChange={(d) => update({ date: d })} />
            <Button
              variant="secondary"
              size="sm"
              loading={exportM.isPending}
              disabled={exportM.isPending}
              onClick={() => exportM.mutate({ date, standard })}
            >
              Export Excel
            </Button>
          </div>
        }
      />

      {(q.data?.exceptions.length ?? 0) > 0 && (
        <ExceptionsPanel
          exceptions={q.data!.exceptions}
          exceptionsOnly={exceptionsOnly}
          onToggle={(on) => {
            setExceptionsOnly(on);
            update({ exc: on ? '1' : null });
          }}
        />
      )}

      <PortfolioTable
        rows={q.data?.rows ?? []}
        standard={standard}
        exceptionsOnly={exceptionsOnly}
        isLoading={q.isLoading}
        onRowClick={(plantId) => router.push(`/plants/${plantId}/dashboard/${date}`)}
      />
    </div>
  );
}
