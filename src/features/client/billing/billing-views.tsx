'use client';

import {
  AlertTriangle,
  ArrowRight,
  BadgeIndianRupee,
  CalendarClock,
  CreditCard,
  FileDown,
  Landmark,
  PiggyBank,
  Receipt,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { StatCard } from '@/components/data/stat-card';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/input';
import { CopyButton, EmptyState, ProgressBar, Skeleton } from '@/components/ui/misc';
import { Segmented, Tabs } from '@/components/ui/tabs';
import { DataTable, Pagination, type Column } from '@/components/ui/table';
import { errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { diffDays, todayIST } from '@/lib/dates';
import { DASH, fmtDate, fmtMoney, fmtMoney0 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ClientAdminOnly } from '../company/company-api';
import { useBillingSummary } from '../queries';
import {
  OPEN_STATUSES,
  openBillingPdf,
  payNow,
  useCredit,
  useInvoice,
  useInvoices,
  useNotifications,
  usePayments,
  useSubscriptions,
  type BankDetails,
  type Invoice,
  type InvoiceRef,
  type InvoiceStatus,
} from './billing-api';
import { PaidDialog, TdsDialog } from './billing-dialogs';

const BILLING_TABS = [
  { href: '/billing', label: 'Overview' },
  { href: '/billing/invoices', label: 'Invoices' },
  { href: '/billing/payments', label: 'Payments & receipts' },
  { href: '/billing/subscriptions', label: 'Subscriptions' },
];
function BillingTabs({ active }: { active: string }) {
  return (
    <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
      {BILLING_TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors',
            t.href === active
              ? 'border-ink-900 bg-ink-900 text-white'
              : 'border-line bg-surface text-ink-700 hover:border-ink-300',
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

const dueText = (inv: Invoice) => {
  if (!inv.dueDate || !OPEN_STATUSES.includes(inv.status)) return null;
  const d = diffDays(inv.dueDate, todayIST());
  return d < 0 ? (
    <span className="text-danger-600">{-d} day(s) overdue</span>
  ) : d === 0 ? (
    'due today'
  ) : (
    `due in ${d} day(s)`
  );
};

/** Pay / I have paid / TDS / PDF for one invoice row or page. */
function InvoiceActions({
  inv,
  onPaid,
  onTds,
  compact,
}: {
  inv: InvoiceRef;
  onPaid: () => void;
  onTds: () => void;
  compact?: boolean;
}) {
  const open = OPEN_STATUSES.includes(inv.status) && Number(inv.balance) > 0;
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      {open && (
        <Button
          size={compact ? 'sm' : 'md'}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await payNow(inv.id);
            setBusy(false);
          }}
        >
          <CreditCard /> Pay {compact ? '' : fmtMoney(inv.balance)}
        </Button>
      )}
      {open && !compact && (
        <>
          <Button variant="secondary" onClick={onPaid}>
            <Landmark /> I have paid
          </Button>
          <Button variant="ghost" onClick={onTds}>
            <BadgeIndianRupee /> Record TDS
          </Button>
        </>
      )}
      <Button
        size={compact ? 'sm' : 'md'}
        variant="ghost"
        onClick={() => void openBillingPdf(`/invoices/${inv.id}/pdf`)}
        disabled={!inv.pdfReady}
      >
        <FileDown /> PDF
      </Button>
    </div>
  );
}

function invoiceColumns(onPaid: (i: Invoice) => void, onTds: (i: Invoice) => void): Column<Invoice>[] {
  return [
    {
      key: 'no',
      header: 'Invoice',
      cell: (i) => (
        <div>
          <p className="text-ink-900 font-semibold">{i.number ?? DASH}</p>
          <p className="text-ink-500 max-w-[260px] truncate text-xs">{i.plants ?? i.kind}</p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Issued',
      hideBelow: 'md',
      cell: (i) => <span className="tabular">{fmtDate(i.issueDate)}</span>,
    },
    {
      key: 'due',
      header: 'Due',
      hideBelow: 'sm',
      cell: (i) => (
        <div>
          <p className="tabular">{fmtDate(i.dueDate)}</p>
          <p className="text-ink-500 text-xs">{dueText(i)}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (i) => <span className="tabular">{fmtMoney(i.total)}</span>,
    },
    {
      key: 'bal',
      header: 'Balance',
      align: 'right',
      cell: (i) => (
        <span className={cn('tabular font-semibold', Number(i.balance) > 0 ? 'text-ink-900' : 'text-success-600')}>
          {fmtMoney(i.balance)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: '120px', cell: (i) => <StatusBadge status={i.status} size="sm" /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      cell: (i) => <InvoiceActions compact inv={i} onPaid={() => onPaid(i)} onTds={() => onTds(i)} />,
    },
  ];
}

// ---------------------------------------------------------------- /billing
export function BillingOverview() {
  const { profile } = useClientAuth();
  const s = useBillingSummary(!!profile?.user.isClientAdmin);
  // one query per open status (the API filters one status at a time; 100 = API maximum)
  const overdue = useInvoices({ status: 'overdue', page: 1, pageSize: 100 });
  const part = useInvoices({ status: 'partially_paid', page: 1, pageSize: 100 });
  const issued = useInvoices({ status: 'issued', page: 1, pageSize: 100 });
  const open = { isLoading: overdue.isLoading || part.isLoading || issued.isLoading };
  const notes = useNotifications();
  const [paid, setPaid] = useState<Invoice | null>(null);
  const [tds, setTds] = useState<Invoice | null>(null);
  const openInv = [...(overdue.data?.items ?? []), ...(part.data?.items ?? []), ...(issued.data?.items ?? [])]
    .filter((i) => Number(i.balance) > 0)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')); // oldest due first
  const pending = (notes.data ?? []).filter((n) => n.status === 'pending');
  const instr = s.data?.paymentInstructions;
  const bank: Partial<BankDetails> = (instr?.bank as BankDetails | null) ?? {};
  const state = s.data?.accountState ?? profile?.tenant.accountState;
  return (
    <ClientAdminOnly title="Billing">
      <PageHeader
        title="Billing"
        subtitle="Invoices, payments and subscriptions of all your plants"
        badge={state ? <StatusBadge status={state} /> : undefined}
      />
      <BillingTabs active="/billing" />
      {state && state !== 'active' && state !== 'terminated' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-warning-100 bg-warning-50 mb-6 flex items-center gap-3 rounded-2xl border p-4"
        >
          <AlertTriangle className="text-warning-500 size-5 shrink-0" />
          <p className="text-ink-700 flex-1 text-sm">
            {state === 'grace'
              ? 'An invoice is overdue. Everything still works — please pay soon to avoid read-only access.'
              : 'Pay the overdue invoices to restore full access. Payments by card or UPI are applied within minutes.'}
          </p>
        </motion.div>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Outstanding"
          icon={<Wallet />}
          value={s.data ? Number(s.data.outstanding) : null}
          format={fmtMoney0}
          loading={s.isLoading}
        />
        <StatCard
          title="Overdue"
          icon={<AlertTriangle />}
          iconTone={Number(s.data?.overdue ?? 0) > 0 ? 'danger' : 'success'}
          value={s.data ? Number(s.data.overdue) : null}
          format={fmtMoney0}
          loading={s.isLoading}
        />
        <StatCard
          title="Next due"
          icon={<CalendarClock />}
          iconTone="warning"
          value={s.data?.nextDue ? diffDays(s.data.nextDue, todayIST()) : null}
          format={(d) => (d < 0 ? 'overdue' : `${d} days`)}
          caption={s.data?.nextDue ? fmtDate(s.data.nextDue) : 'nothing due'}
          loading={s.isLoading}
        />
        <StatCard
          title="Advance / credit"
          icon={<PiggyBank />}
          iconTone="purple"
          value={s.data ? Number(s.data.creditBalance) : null}
          format={fmtMoney0}
          loading={s.isLoading}
          caption="adjusted against your invoices"
        />
      </div>
      <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader
            title="Open invoices"
            subtitle={openInv.length ? `${openInv.length} to pay` : 'All paid — thank you!'}
            action={
              <Button variant="link" asChild>
                <Link href="/billing/invoices">
                  All invoices <ArrowRight />
                </Link>
              </Button>
            }
          />
          {open.isLoading ? (
            <Skeleton className="h-40 rounded-xl" />
          ) : openInv.length === 0 ? (
            <EmptyState compact icon={<Receipt />} title="No open invoices" />
          ) : (
            <ul className="space-y-3">
              {openInv.map((i) => {
                const paidPct = Number(i.total) ? ((Number(i.total) - Number(i.balance)) / Number(i.total)) * 100 : 0;
                return (
                  <li key={i.id} className="rounded-inner border-line border p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/billing/invoices/${i.id}`}
                          className="text-ink-900 hover:text-brand-500 font-semibold"
                        >
                          {i.number}
                        </Link>
                        <p className="text-ink-500 truncate text-xs">
                          {i.plants ?? 'Other charges'} · {dueText(i)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-ink-900 tabular text-lg font-semibold">{fmtMoney(i.balance)}</p>
                        <p className="text-ink-400 text-xs">of {fmtMoney(i.total)}</p>
                      </div>
                    </div>
                    <ProgressBar
                      className="my-3"
                      value={paidPct}
                      tone={i.status === 'overdue' ? 'danger' : 'success'}
                      height={6}
                    />
                    <InvoiceActions inv={i} onPaid={() => setPaid(i)} onTds={() => setTds(i)} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader icon={<Landmark />} title="Pay by bank transfer" subtitle={instr?.note} />
            <dl className="space-y-2.5 text-[13px]">
              {[
                ['Payee', instr?.payee],
                ['Account name', bank.accountName],
                ['Account no.', bank.accountNo],
                ['IFSC', bank.ifsc],
                ['Branch', bank.branch],
                ['UPI', instr?.upiId],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className="text-ink-900 flex items-center gap-1 font-semibold">
                      <span className="tabular">{v}</span>
                      <CopyButton value={String(v)} />
                    </dd>
                  </div>
                ))}
            </dl>
            <p className="text-ink-400 mt-4 text-xs">
              After paying, use &quot;I have paid&quot; on the invoice so we can match it quickly.
            </p>
          </Card>
          {pending.length > 0 && (
            <Card>
              <CardHeader title="Waiting for confirmation" />
              <ul className="space-y-2">
                {pending.map((n) => (
                  <li
                    key={n.id}
                    className="bg-canvas flex items-center justify-between rounded-xl px-3 py-2 text-[13px]"
                  >
                    <span>
                      <span className="text-ink-900 font-semibold">{fmtMoney(n.amount)}</span>{' '}
                      <span className="text-ink-500">· {n.invoiceNo}</span>
                    </span>
                    <span className="text-ink-400 text-xs">{fmtDate(n.paidOn)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <PaidDialog invoice={paid} onClose={() => setPaid(null)} />
      <TdsDialog invoice={tds} onClose={() => setTds(null)} />
    </ClientAdminOnly>
  );
}

// ---------------------------------------------------------------- /billing/invoices
const PAGE = 20;
export function InvoicesView() {
  const router = useRouter();
  const [status, setStatus] = useState<'all' | InvoiceStatus>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useInvoices({
    status: status === 'all' ? undefined : status,
    q: search.trim() || undefined,
    page,
    pageSize: PAGE,
  });
  const [paid, setPaid] = useState<Invoice | null>(null);
  const [tds, setTds] = useState<Invoice | null>(null);
  return (
    <ClientAdminOnly title="Invoices">
      <PageHeader title="Invoices" subtitle="Tax invoices of your plant subscriptions" />
      <BillingTabs active="/billing/invoices" />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* 6 filters do not fit a phone: let them scroll sideways */}
          <div className="scrollbar-none max-w-full overflow-x-auto">
            <Segmented
              value={status}
              onChange={(s) => {
                setStatus(s);
                setPage(1);
              }}
              items={[
                { value: 'all', label: 'All' },
                { value: 'issued', label: 'Issued' },
                { value: 'partially_paid', label: 'Partly paid' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'paid', label: 'Paid' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
          <SearchInput
            className="w-full sm:ml-auto sm:w-60"
            placeholder="Invoice number…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <DataTable
          loading={q.isLoading}
          rows={q.data?.items}
          rowKey={(i) => i.id}
          onRowClick={(i) => router.push(`/billing/invoices/${i.id}`)}
          empty="No invoices."
          columns={invoiceColumns(setPaid, setTds)}
        />
        {q.data && q.data.meta.total > PAGE && (
          <Pagination className="mt-4" page={page} pageSize={PAGE} total={q.data.meta.total} onPageChange={setPage} />
        )}
      </Card>
      <PaidDialog invoice={paid} onClose={() => setPaid(null)} />
      <TdsDialog invoice={tds} onClose={() => setTds(null)} />
    </ClientAdminOnly>
  );
}

// ---------------------------------------------------------------- /billing/invoices/:id
function Line({ label, value, strong, tone }: { label: ReactNode; value: string; strong?: boolean; tone?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 py-1.5 text-[13px]',
        strong && 'border-line mt-1 border-t pt-3 text-sm',
      )}
    >
      <span className={strong ? 'text-ink-900 font-semibold' : 'text-ink-500'}>{label}</span>
      <span className={cn('tabular', strong ? 'text-ink-900 text-base font-bold' : 'text-ink-900', tone)}>{value}</span>
    </div>
  );
}

export function InvoiceDetailView() {
  const { id } = useParams<{ id: string }>();
  const q = useInvoice(id);
  const [paid, setPaid] = useState<InvoiceRef | null>(null);
  const [tds, setTds] = useState<InvoiceRef | null>(null);
  const [tab, setTab] = useState<'lines' | 'payments' | 'tds' | 'credit'>('lines');
  const i = q.data;
  const tdsTotal = (i?.tds ?? []).filter((t) => t.verified).reduce((a, t) => a + Number(t.amount), 0);
  return (
    <ClientAdminOnly title="Invoice">
      {q.isError ? (
        <Card>
          <EmptyState icon={<Receipt />} title="Invoice not found" description={errorMessage(q.error)} />
        </Card>
      ) : !i ? (
        <Skeleton className="rounded-card h-96" />
      ) : (
        <>
          <PageHeader
            title={`Invoice ${i.number ?? ''}`}
            badge={<StatusBadge status={i.status} />}
            subtitle={`${i.plants ?? ''} · issued ${fmtDate(i.issueDate)} · due ${fmtDate(i.dueDate)}`}
            crumbs={[
              { label: 'Billing', href: '/billing' },
              { label: 'Invoices', href: '/billing/invoices' },
              { label: i.number ?? '' },
            ]}
            actions={<InvoiceActions inv={i} onPaid={() => setPaid(i)} onTds={() => setTds(i)} />}
          />
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <Tabs
                className="mb-5"
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'lines', label: 'Lines', count: i.lines.length },
                  { value: 'payments', label: 'Payments', count: i.payments.length },
                  { value: 'tds', label: 'TDS', count: i.tds.length },
                  { value: 'credit', label: 'Credit notes', count: i.creditNotes.length },
                ]}
              />
              {tab === 'lines' && (
                <DataTable
                  rows={i.lines}
                  rowKey={(l) => l.id}
                  columns={[
                    {
                      key: 'd',
                      header: 'Description',
                      cell: (l) => <span className="text-ink-900">{l.description}</span>,
                    },
                    { key: 'sac', header: 'SAC', hideBelow: 'md', cell: (l) => l.sac ?? DASH },
                    {
                      key: 'qty',
                      header: 'Qty',
                      align: 'right',
                      cell: (l) => <span className="tabular">{Number(l.qty)}</span>,
                    },
                    {
                      key: 'rate',
                      header: 'Rate',
                      align: 'right',
                      cell: (l) => <span className="tabular">{fmtMoney(l.rate)}</span>,
                    },
                    {
                      key: 'amt',
                      header: 'Taxable',
                      align: 'right',
                      cell: (l) => <span className="tabular font-semibold">{fmtMoney(l.taxable)}</span>,
                    },
                  ]}
                />
              )}
              {tab === 'payments' && (
                <DataTable
                  rows={i.payments}
                  rowKey={(p) => p.paymentId}
                  empty="No payment yet."
                  columns={[
                    { key: 'd', header: 'Date', cell: (p) => fmtDate(p.paymentDate) },
                    { key: 'm', header: 'Mode', cell: (p) => <span className="uppercase">{p.mode}</span> },
                    { key: 'r', header: 'Reference', hideBelow: 'md', cell: (p) => p.reference ?? DASH },
                    {
                      key: 'a',
                      header: 'Amount',
                      align: 'right',
                      cell: (p) => <span className="tabular font-semibold">{fmtMoney(p.amount)}</span>,
                    },
                    { key: 's', header: 'Status', cell: (p) => <StatusBadge status={p.status} size="sm" /> },
                    {
                      key: 'rc',
                      header: 'Receipt',
                      align: 'right',
                      hideBelow: 'sm',
                      cell: (p) =>
                        p.receiptNo ? (
                          <Link href="/billing/payments" className="text-brand-500 text-xs font-semibold">
                            {p.receiptNo}
                          </Link>
                        ) : (
                          DASH
                        ),
                    },
                  ]}
                />
              )}
              {tab === 'tds' && (
                <DataTable
                  rows={i.tds}
                  rowKey={(t) => t.id}
                  empty="No TDS recorded."
                  columns={[
                    { key: 'd', header: 'Deducted', cell: (t) => fmtDate(t.deductionDate) },
                    { key: 's', header: 'Section', cell: (t) => t.section },
                    {
                      key: 'a',
                      header: 'Amount',
                      align: 'right',
                      cell: (t) => <span className="tabular font-semibold">{fmtMoney(t.amount)}</span>,
                    },
                    {
                      key: 'c',
                      header: 'Form 16A',
                      cell: (t) =>
                        t.certificateStatus === 'received' || t.certificateUploaded ? (
                          <Badge tone="success" size="sm">
                            Received
                          </Badge>
                        ) : (
                          <Badge size="sm">Pending</Badge>
                        ),
                    },
                    {
                      key: 'v',
                      header: '',
                      cell: (t) =>
                        t.verified ? (
                          <Badge tone="success" size="sm">
                            Verified
                          </Badge>
                        ) : (
                          <Badge tone="warning" size="sm">
                            Checking
                          </Badge>
                        ),
                    },
                  ]}
                />
              )}
              {tab === 'credit' && (
                <DataTable
                  rows={i.creditNotes}
                  rowKey={(c) => c.id}
                  empty="No credit notes."
                  columns={[
                    { key: 'n', header: 'Credit note', cell: (c) => <span className="font-semibold">{c.number}</span> },
                    { key: 'd', header: 'Date', cell: (c) => fmtDate(c.date) },
                    { key: 'r', header: 'Reason', hideBelow: 'md', cell: (c) => c.reason },
                    {
                      key: 't',
                      header: 'Total',
                      align: 'right',
                      cell: (c) => <span className="tabular">{fmtMoney(c.total)}</span>,
                    },
                    {
                      key: 'p',
                      header: '',
                      align: 'right',
                      cell: (c) => (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!c.pdfReady}
                          onClick={() => void openBillingPdf(`/credit-notes/${c.id}/pdf`)}
                        >
                          <FileDown /> PDF
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </Card>
            <Card>
              <CardHeader
                title="Amount"
                subtitle={`${i.gstType === 'inter' ? 'IGST' : i.gstType === 'intra' ? 'CGST + SGST' : 'GST'} @ ${i.gstRatePct}% · place of supply ${i.placeOfSupply ?? DASH}`}
              />
              <Line label="Taxable value" value={fmtMoney(i.taxable)} />
              {i.gstType === 'inter' || Number(i.igst) > 0 ? (
                <Line label="IGST" value={fmtMoney(i.igst)} />
              ) : (
                <>
                  <Line label="CGST" value={fmtMoney(i.cgst)} />
                  <Line label="SGST" value={fmtMoney(i.sgst)} />
                </>
              )}
              {Number(i.roundOff) !== 0 && <Line label="Round off" value={fmtMoney(i.roundOff)} />}
              <Line label="Invoice total" value={fmtMoney(i.total)} strong />
              {Number(i.paid) > 0 && <Line label="Paid" value={`− ${fmtMoney(i.paid)}`} tone="text-success-600" />}
              {tdsTotal > 0 && (
                <Line label="TDS (verified)" value={`− ${fmtMoney(tdsTotal)}`} tone="text-success-600" />
              )}
              {Number(i.creditNoted) > 0 && (
                <Line label="Credit notes" value={`− ${fmtMoney(i.creditNoted)}`} tone="text-success-600" />
              )}
              {Number(i.advanceAdjusted) > 0 && (
                <Line label="Advance used" value={`− ${fmtMoney(i.advanceAdjusted)}`} tone="text-success-600" />
              )}
              {Number(i.movedToCredit) > 0 && (
                <Line label="Excess moved to your advance" value={`+ ${fmtMoney(i.movedToCredit)}`} />
              )}
              {Number(i.writtenOff) > 0 && (
                <Line
                  label="Small difference written off"
                  value={`− ${fmtMoney(i.writtenOff)}`}
                  tone="text-success-600"
                />
              )}
              <Line
                label="Balance"
                value={fmtMoney(i.balance)}
                strong
                tone={Number(i.balance) > 0 ? 'text-danger-600' : 'text-success-600'}
              />
              {i.notes && <p className="text-ink-500 mt-4 text-xs">{i.notes}</p>}
              {i.cancelReason && <p className="text-danger-600 mt-4 text-xs">Cancelled: {i.cancelReason}</p>}
            </Card>
          </div>
        </>
      )}
      <PaidDialog invoice={paid} onClose={() => setPaid(null)} />
      <TdsDialog invoice={tds} onClose={() => setTds(null)} />
    </ClientAdminOnly>
  );
}

// ---------------------------------------------------------------- /billing/payments
export function PaymentsView() {
  const pays = usePayments();
  const notes = useNotifications();
  const credit = useCredit();
  const [tab, setTab] = useState<'payments' | 'notices' | 'credit'>('payments');
  return (
    <ClientAdminOnly title="Payments & receipts">
      <PageHeader
        title="Payments & receipts"
        subtitle="Every payment we received, its receipt, and your advance balance"
      />
      <BillingTabs active="/billing/payments" />
      <Card>
        <Tabs
          className="mb-5"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'payments', label: 'Payments', count: pays.data?.length },
            { value: 'notices', label: '"I have paid" notices', count: notes.data?.length },
            { value: 'credit', label: `Advance ${credit.data ? fmtMoney0(credit.data.balance) : ''}` },
          ]}
        />
        {tab === 'payments' && (
          <DataTable
            loading={pays.isLoading}
            rows={pays.data}
            rowKey={(p) => p.id}
            empty="No payments yet."
            columns={[
              { key: 'd', header: 'Date', cell: (p) => <span className="tabular">{fmtDate(p.paymentDate)}</span> },
              { key: 'm', header: 'Mode', cell: (p) => <span className="uppercase">{p.mode}</span> },
              {
                key: 'inv',
                header: 'Against',
                hideBelow: 'md',
                cell: (p) => (
                  <span className="text-ink-500 text-xs">
                    {(p.allocations ?? []).length === 0
                      ? 'Advance'
                      : (p.allocations ?? [])
                          .map((a) =>
                            (p.allocations ?? []).length > 1
                              ? `${a.invoiceNo ?? 'Advance'} ${fmtMoney0(a.amount)}`
                              : (a.invoiceNo ?? 'Advance'),
                          )
                          .join(' · ')}
                  </span>
                ),
              },
              {
                key: 'a',
                header: 'Amount',
                align: 'right',
                cell: (p) => <span className="tabular font-semibold">{fmtMoney(p.amount)}</span>,
              },
              { key: 's', header: 'Status', cell: (p) => <StatusBadge status={p.status} size="sm" /> },
              {
                key: 'r',
                header: 'Receipt',
                align: 'right',
                cell: (p) =>
                  p.receiptId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!p.receiptReady}
                      onClick={() => void openBillingPdf(`/receipts/${p.receiptId}/pdf`)}
                    >
                      <FileDown /> {p.receiptNo}
                    </Button>
                  ) : (
                    DASH
                  ),
              },
            ]}
          />
        )}
        {tab === 'notices' && (
          <DataTable
            loading={notes.isLoading}
            rows={notes.data}
            rowKey={(n) => n.id}
            empty="You have not reported a bank transfer."
            columns={[
              { key: 'd', header: 'Paid on', cell: (n) => fmtDate(n.paidOn) },
              { key: 'i', header: 'Invoice', cell: (n) => n.invoiceNo },
              { key: 'r', header: 'Reference', hideBelow: 'md', cell: (n) => n.reference },
              {
                key: 'a',
                header: 'Amount',
                align: 'right',
                cell: (n) => <span className="tabular font-semibold">{fmtMoney(n.amount)}</span>,
              },
              {
                key: 's',
                header: 'Status',
                cell: (n) => (
                  <div>
                    <StatusBadge
                      status={n.status === 'verified' ? 'applied' : n.status === 'rejected' ? 'failed' : 'pending'}
                      label={n.status === 'verified' ? 'Verified' : n.status === 'rejected' ? 'Rejected' : 'Checking'}
                      size="sm"
                    />
                    {n.note && <p className="text-ink-500 mt-0.5 text-xs">{n.note}</p>}
                  </div>
                ),
              },
            ]}
          />
        )}
        {tab === 'credit' && (
          <div>
            <div className="bg-premium relative mb-5 overflow-hidden rounded-2xl p-5 text-white">
              <p className="text-sm text-white/70">Advance / credit balance</p>
              <p className="mt-1 text-3xl font-semibold">{credit.data ? fmtMoney(credit.data.balance) : DASH}</p>
              <p className="mt-1 text-xs text-white/60">
                Adjusted against your invoices by our accounts team (or automatically, if enabled).
              </p>
            </div>
            <DataTable
              loading={credit.isLoading}
              rows={credit.data?.ledger}
              rowKey={(r, n) => `${r.date}-${n}`}
              empty="No movements."
              columns={[
                { key: 'd', header: 'Date', cell: (r) => fmtDate(r.date) },
                {
                  key: 'k',
                  header: 'Entry',
                  cell: (r) => <span className="capitalize">{r.kind.replace(/_/g, ' ')}</span>,
                },
                {
                  key: 'a',
                  header: 'Amount',
                  align: 'right',
                  cell: (r) => (
                    <span
                      className={cn(
                        'tabular font-semibold',
                        Number(r.amount) < 0 ? 'text-danger-600' : 'text-success-600',
                      )}
                    >
                      {fmtMoney(r.amount)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Card>
    </ClientAdminOnly>
  );
}

// ---------------------------------------------------------------- /billing/subscriptions
export function SubscriptionsView() {
  const q = useSubscriptions();
  const today = todayIST();
  return (
    <ClientAdminOnly title="Subscriptions">
      <PageHeader title="Subscriptions" subtitle="Plan, term and billing schedule of every plant" />
      <BillingTabs active="/billing/subscriptions" />
      {q.isLoading ? (
        <Skeleton className="rounded-card h-80" />
      ) : (q.data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt />}
            title="No plants yet"
            description="Subscriptions appear here once a plant is set up."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {(q.data ?? []).map((p, n) => {
            const s = p.subscription;
            const total = s ? Math.max(1, diffDays(s.endDate, s.startDate)) : 1;
            const done = s ? Math.min(100, Math.max(0, (diffDays(today, s.startDate) / total) * 100)) : 0;
            return (
              <motion.div
                key={p.plantId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: n * 0.05 }}
              >
                <Card>
                  <div className="flex flex-wrap items-start gap-4">
                    <span className="bg-brand-50 text-brand-500 grid size-11 place-items-center rounded-2xl text-xs font-bold">
                      {p.plantCode}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink-900 text-base font-semibold">{p.plantName}</p>
                      <p className="text-ink-500 text-xs">
                        {s
                          ? `${s.planName} · ${s.termYears} years · billed ${s.billingMode === 'upfront' ? 'upfront' : 'yearly'}`
                          : 'No subscription'}
                      </p>
                    </div>
                    <StatusBadge status={p.accountState} />
                    {s && s.status === 'scheduled' && (
                      <StatusBadge status="scheduled" label={`Starts ${fmtDate(s.startDate)}`} />
                    )}
                    {s && (
                      <div className="text-right">
                        <p className="text-ink-900 tabular text-lg font-semibold">{fmtMoney0(s.pricePerYear)}</p>
                        <p className="text-ink-400 text-xs">per year + GST</p>
                      </div>
                    )}
                  </div>
                  {s && (
                    <>
                      <div className="mt-5">
                        <div className="text-ink-500 mb-1.5 flex justify-between text-xs">
                          <span>{fmtDate(s.startDate)}</span>
                          <span>{fmtDate(s.endDate)}</span>
                        </div>
                        <ProgressBar value={done} tone="brand" height={6} />
                      </div>
                      <div className="rounded-inner border-line mt-5 overflow-x-auto border">
                        <table className="w-full min-w-[640px] text-[13px]">
                          <thead className="bg-canvas text-ink-400 text-left text-[11px] tracking-wider uppercase">
                            <tr>
                              <th className="px-4 py-2 font-medium">Year</th>
                              <th className="px-4 py-2 font-medium">Period</th>
                              <th className="px-4 py-2 font-medium">Invoice date</th>
                              <th className="px-4 py-2 font-medium">Due</th>
                              <th className="px-4 py-2 text-right font-medium">Amount</th>
                              <th className="px-4 py-2 font-medium" />
                            </tr>
                          </thead>
                          <tbody className="divide-line divide-y">
                            {s.schedule.map((y) => (
                              <tr key={y.id}>
                                <td className="px-4 py-2 font-semibold">Year {y.yearNo}</td>
                                <td className="tabular px-4 py-2">
                                  {fmtDate(y.periodFrom)} – {fmtDate(y.periodTo)}
                                </td>
                                <td className="tabular px-4 py-2">{fmtDate(y.plannedInvoiceDate)}</td>
                                <td className="tabular px-4 py-2">{fmtDate(y.dueDate)}</td>
                                <td className="tabular px-4 py-2 text-right">{fmtMoney(y.amount)}</td>
                                <td className="px-4 py-2 text-right">
                                  {y.invoiceId ? (
                                    <Link
                                      href={`/billing/invoices/${y.invoiceId}`}
                                      className="text-brand-500 text-xs font-semibold"
                                    >
                                      Invoiced →
                                    </Link>
                                  ) : (
                                    <Badge size="sm">Planned</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-ink-500 mt-3 text-right text-xs">
                        Total for the term (excl. GST): {fmtMoney(s.totalExGst)}
                      </p>
                    </>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </ClientAdminOnly>
  );
}
