'use client';

import { Banknote, BadgeCheck, ShieldCheck, Users } from 'lucide-react';
import { CountUp } from '@/components/motion/count-up';
import { SplitBars } from '@/components/charts/split-bars';
import { StatusBadge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { diffDays } from '@/lib/dates';
import { fmtDate, fmtMoney0, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardData, RegisterRow } from '../engine-types';
import { CardMiniChart } from './parts';

type CashData = NonNullable<DashboardData['cash']>;
type StaffData = NonNullable<DashboardData['staff']>;
type RegistersData = NonNullable<DashboardData['registers']>;

export function CashCard({ cash }: { cash: CashData }) {
  const rows = [
    { label: 'Spent today', value: cash.today },
    { label: 'This month', value: cash.mtd },
    { label: 'Since MIS start', value: cash.utd },
  ];
  return (
    <Card>
      <CardHeader title="Site cash" icon={<Banknote />} />
      <p className="text-ink-500 text-xs font-medium">Cash in hand</p>
      <p
        className={cn(
          'mt-1 text-[32px] leading-none font-bold tracking-tight',
          (cash.inHand ?? 0) < 0 ? 'text-danger-600' : 'text-ink-900',
        )}
      >
        <CountUp value={cash.inHand} format={fmtMoney0} />
      </p>
      <dl className="divide-line mt-4 divide-y divide-dashed">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between py-2 text-sm">
            <dt className="text-ink-500">{r.label}</dt>
            <dd className="text-ink-900 tabular font-semibold">{fmtMoney0(r.value)}</dd>
          </div>
        ))}
      </dl>
      {cash.chart && (
        <div className="-mx-1 mt-3">
          <p className="text-ink-400 mb-1 px-1 text-[10px] font-medium tracking-wider uppercase">Monthly expenses</p>
          <CardMiniChart chart={cash.chart} unit="₹" height={100} />
        </div>
      )}
    </Card>
  );
}

export function StaffCard({ staff }: { staff: StaffData }) {
  const present = staff.reduce((s, r) => s + (r.present ?? 0), 0);
  const absent = staff.reduce((s, r) => s + (r.absent ?? 0), 0);
  const tones = ['blue', 'green', 'orange', 'purple'] as const;
  return (
    <Card>
      <CardHeader
        title="Staff today"
        icon={<Users />}
        subtitle={`${fmtNum(present)} present · ${fmtNum(absent)} absent`}
      />
      {staff.length === 0 ? (
        <EmptyState compact title="No staff categories" />
      ) : (
        <>
          <SplitBars
            items={staff.map((r, i) => ({
              label: r.category,
              value: r.present,
              tone: tones[i % tones.length] ?? 'blue',
            }))}
          />
          <ul className="mt-4 space-y-1.5">
            {staff.map((r) => (
              <li key={r.category} className="flex items-center justify-between text-[13px]">
                <span className="text-ink-700">{r.category}</span>
                <span
                  className={cn(
                    'tabular rounded-md px-1.5 py-0.5 text-xs font-medium',
                    r.absentFlag === 'bad' ? 'bg-danger-50 text-danger-600' : 'bg-muted-bg text-ink-500',
                  )}
                >
                  {fmtNum(r.absent ?? 0)} absent
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

const REG_STATUS: Record<RegisterRow['status'], string> = {
  VALID: 'active',
  EXPIRING: 'grace',
  EXPIRED: 'overdue',
  NOT_AVAILABLE: 'draft',
};
const REG_LABEL: Record<RegisterRow['status'], string> = {
  VALID: 'Valid',
  EXPIRING: 'Expiring',
  EXPIRED: 'Expired',
  NOT_AVAILABLE: 'Not on file',
};

export function RegistersCard({ registers, date }: { registers: RegistersData; date: string }) {
  const rows = [
    ...registers.bankGuarantees.map((r) => ({ ...r, group: 'Bank guarantee' })),
    ...registers.insurance.map((r) => ({ ...r, group: 'Insurance' })),
  ];
  return (
    <Card>
      <CardHeader title="Guarantees & insurance" icon={<ShieldCheck />} subtitle={`Validity on ${fmtDate(date)}`} />
      {rows.length === 0 ? (
        <EmptyState compact icon={<BadgeCheck />} title="Nothing registered" />
      ) : (
        <ul className="divide-line divide-y divide-dashed">
          {rows.map((r) => {
            const left = r.end ? diffDays(r.end, date) : null;
            return (
              <li key={`${r.group}-${r.label}`} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="text-ink-900 block truncate text-[13px] font-semibold">
                    {r.group} · {r.label}
                  </span>
                  <span className="text-ink-500 block truncate text-xs">
                    {r.end ? (
                      <>
                        until {fmtDate(r.end)}
                        {left !== null && left >= 0 && <> · {fmtNum(left)} days left</>}
                      </>
                    ) : (
                      'No record'
                    )}
                  </span>
                </span>
                <StatusBadge status={REG_STATUS[r.status]} label={REG_LABEL[r.status]} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
