'use client';

import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Factory,
  FileWarning,
  IndianRupee,
  MailWarning,
  Receipt,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { BarChart } from '@/components/charts/bar-chart';
import { Donut } from '@/components/charts/donut';
import { StatCard } from '@/components/data/stat-card';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/tabs';
import { fmtCompact, fmtDate, fmtMoney, fmtMoney0, fmtMonthShort, fmtNum, fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { labelize, useA } from './kit';
import type { ActionList, AdminDashboard } from './types';

const money = (n: number) => fmtCompact(n, { money: true });

/** /admin — KPIs, collections, money due soon, renewals and the action list (SA-DB-01…06). */
export function AdminDashboardView() {
  const d = useA<AdminDashboard>('/dashboard', undefined, { refetchInterval: 60_000 });
  const a = useA<ActionList>('/dashboard/action-list', undefined, { refetchInterval: 60_000 });
  const [win, setWin] = useState<'d30' | 'd60' | 'd90'>('d30');
  const x = d.data;
  const n = (v: string | undefined) => (v === undefined ? undefined : Number(v));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={x ? `Financial year ${x.fy} · updates every minute` : 'Platform overview'}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/admin/payments/record">
                <Banknote /> Record payment
              </Link>
            </Button>
            <Button asChild>
              <Link href="/admin/clients/new">
                <Building2 /> New client
              </Link>
            </Button>
          </>
        }
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <StatCard
            title="Billed this FY"
            icon={<Receipt />}
            value={n(x?.money.billed)}
            format={fmtMoney0}
            loading={d.isLoading}
            caption={x && `${fmtMoney0(x.money.creditNotes)} credit notes`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Collected this FY"
            icon={<Wallet />}
            iconTone="success"
            value={n(x?.money.collected)}
            format={fmtMoney0}
            loading={d.isLoading}
            caption={x && `${fmtMoney0(x.money.tdsReceivable)} TDS receivable`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Outstanding"
            icon={<IndianRupee />}
            iconTone="warning"
            value={n(x?.money.outstanding)}
            format={fmtMoney0}
            loading={d.isLoading}
            onClick={() => location.assign('/admin/invoices')}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            title="Overdue"
            icon={<AlertTriangle />}
            iconTone="danger"
            value={n(x?.money.overdue)}
            format={fmtMoney0}
            loading={d.isLoading}
            onClick={() => location.assign('/admin/invoices?status=overdue')}
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Collections"
              subtitle="Money received per month (all modes, after clearance)"
              action={x && <Badge tone="success">{fmtMoney0(x.money.collected)} this FY</Badge>}
            />
            {!x ? (
              <Skeleton className="h-[240px] rounded-xl" />
            ) : (
              <BarChart
                height={240}
                format={money}
                seriesLabel="Collected"
                data={x.collectionsTrend.map((m) => ({ label: fmtMonthShort(m.month), value: Number(m.amount) }))}
              />
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                icon={<CalendarClock />}
                title="Due soon"
                action={
                  <Segmented
                    size="sm"
                    value={win}
                    onChange={setWin}
                    items={[
                      { value: 'd30', label: '30 d' },
                      { value: 'd60', label: '60 d' },
                      { value: 'd90', label: '90 d' },
                    ]}
                  />
                }
              />
              {!x ? (
                <Skeleton className="h-40 rounded-xl" />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Tile
                    label="Invoices falling due"
                    value={fmtNum(x.dueSoon[win].count)}
                    sub={fmtMoney(x.dueSoon[win].amount)}
                  />
                  <Tile
                    label="Subscriptions ending"
                    value={fmtNum(x.endingSoon[win].subscriptions)}
                    href="/admin/subscriptions"
                  />
                  <Tile
                    label="O&M contracts ending"
                    value={fmtNum(x.endingSoon[win].omContracts)}
                    href="/admin/plants"
                  />
                  <Tile label="Register documents expiring" value={fmtNum(x.endingSoon[win].registerDocuments)} />
                </div>
              )}
            </Card>
            <Card>
              <CardHeader
                icon={<Factory />}
                title="Plants"
                subtitle={x && `${fmtNum(x.clients.total)} clients · ${fmtNum(x.plants.total)} plants`}
              />
              {!x ? (
                <Skeleton className="h-40 rounded-xl" />
              ) : (
                <Donut
                  size={150}
                  centre={fmtNum(x.plants.total)}
                  centreLabel="plants"
                  data={Object.entries(x.plants.byType).map(([label, value]) => ({ label, value }))}
                />
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Logsheet usage" subtitle="Yesterday across all live plants" />
              {!x ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <Tile label="Submitted" value={fmtNum(x.usage.submittedYesterday)} />
                  <Tile label="Live plants" value={fmtNum(x.usage.livePlants)} />
                  <Tile
                    label="No logsheet 3 d"
                    value={fmtNum(x.usage.noSubmission3d)}
                    tone={x.usage.noSubmission3d > 0 ? 'danger' : undefined}
                    href="/admin/usage?flag=noLogsheet3d"
                  />
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="Clients by state" />
              {!x ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(x.clients.byState).map(([s, c]) => (
                    <Badge
                      key={s}
                      tone={s === 'active' ? 'success' : s === 'suspended' || s === 'terminated' ? 'danger' : 'warning'}
                    >
                      {labelize(s)} · {fmtNum(c)}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>

        <div className="space-y-6 xl:sticky xl:top-[96px]">
          <ActionListCard counts={x?.actions} list={a.data} loading={a.isLoading} />
          <Card>
            <CardHeader
              title="Recent activity"
              action={
                <Link className="text-brand-500 text-xs font-semibold" href="/admin/audit">
                  Audit log
                </Link>
              }
            />
            {!x ? (
              <Skeleton className="h-60 rounded-xl" />
            ) : x.recentActivity.length === 0 ? (
              <EmptyState compact title="Nothing yet" />
            ) : (
              <ul className="space-y-3">
                {x.recentActivity.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-start gap-3 text-sm">
                    <span className="bg-brand-500 mt-1.5 size-2 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <p className="text-ink-900 truncate font-medium">{labelize(r.action.replace(/\./g, ' · '))}</p>
                      <p className="text-ink-400 truncate text-xs">
                        {r.clientName ?? 'Platform'} · {fmtRelative(r.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Tile({
  label,
  value,
  sub,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  href?: string;
  tone?: 'danger';
}) {
  const body = (
    <div
      className={cn(
        'rounded-inner border-line bg-canvas h-full border p-3 transition-colors',
        href && 'hover:border-ink-300',
      )}
    >
      <p className="text-ink-500 text-xs">{label}</p>
      <p className={cn('text-ink-900 tabular mt-1 text-xl font-semibold', tone === 'danger' && 'text-danger-600')}>
        {value}
      </p>
      {sub && <p className="text-ink-500 tabular text-xs">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ActionListCard({
  counts,
  list,
  loading,
}: {
  counts?: AdminDashboard['actions'];
  list?: ActionList;
  loading: boolean;
}) {
  const rows: Array<{
    key: string;
    label: string;
    count: number;
    href: string;
    icon: ReactNode;
    items: Array<{ id: string; text: string; sub: string }>;
  }> = [
    {
      key: 'cheques',
      label: 'Cheques waiting for clearance',
      count: counts?.chequesPending ?? 0,
      href: '/admin/payments?status=pending_clearance',
      icon: <Banknote />,
      items: (list?.chequesPending ?? []).map((c) => ({
        id: c.id,
        text: `${c.clientName} · ${fmtMoney(c.amount)}`,
        sub: `${c.reference ?? 'Cheque'} · ${fmtDate(c.paymentDate)}`,
      })),
    },
    {
      key: 'notifications',
      label: '“I have paid” to verify',
      count: counts?.paymentNotifications ?? 0,
      href: '/admin/payments?tab=notifications',
      icon: <ClipboardCheck />,
      items: (list?.paymentNotifications ?? []).map((c) => ({
        id: c.id,
        text: `${c.clientName} · ${fmtMoney(c.amount)}`,
        sub: `${c.reference} · ${fmtDate(c.paidOn)}`,
      })),
    },
    {
      key: 'review',
      label: 'Payments needing review',
      count: counts?.paymentsNeedingReview ?? 0,
      href: '/admin/payments?needsReview=true',
      icon: <FileWarning />,
      items: (list?.paymentsNeedingReview ?? []).map((c) => ({
        id: c.id,
        text: `${c.clientName} · ${fmtMoney(c.amount)}`,
        sub: c.reviewNote ?? '',
      })),
    },
    {
      key: 'states',
      label: 'Account changes in the next 7 days',
      count: counts?.stateChangesNext7Days ?? 0,
      href: '/admin/plants',
      icon: <CalendarClock />,
      items: (list?.stateChangesNext7Days ?? []).map((c) => ({
        id: `${c.plantId}-${c.on}`,
        text: `${c.clientName} · ${c.plantName}`,
        sub: `${labelize(c.from)} → ${labelize(c.to)} on ${fmtDate(c.on)}`,
      })),
    },
    {
      key: 'emails',
      label: 'Failed e-mails',
      count: counts?.failedEmails ?? 0,
      href: '/admin/audit',
      icon: <MailWarning />,
      items: (list?.failedEmails ?? []).map((c) => ({
        id: c.id,
        text: `${c.templateCode} → ${c.to.join(', ')}`,
        sub: c.error ?? '',
      })),
    },
  ];
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card>
      <CardHeader
        title="Action list"
        subtitle={loading ? 'Loading…' : total === 0 ? 'All clear' : `${total} item(s) need you`}
      />
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key}>
            <Link
              href={r.href}
              className="rounded-inner hover:bg-canvas border-line flex items-center gap-3 border p-3 transition-colors"
            >
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-[18px]',
                  r.count > 0 ? 'bg-warning-50 text-warning-500' : 'bg-success-50 text-success-600',
                )}
              >
                {r.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink-900 text-sm font-medium">{r.label}</p>
                {r.items[0] && (
                  <p className="text-ink-400 truncate text-xs">
                    {r.items[0].text} · {r.items[0].sub}
                  </p>
                )}
              </div>
              <span className={cn('tabular text-lg font-semibold', r.count > 0 ? 'text-ink-900' : 'text-ink-300')}>
                {r.count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
