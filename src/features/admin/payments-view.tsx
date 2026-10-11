'use client';

import {
  AlertTriangle,
  Ban,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileUp,
  ListChecks,
  Receipt,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { DateField } from '@/components/date/date-field';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable, Pagination } from '@/components/ui/table';
import { Segmented, Tabs } from '@/components/ui/tabs';
import { addDays, todayIST, type DateRange } from '@/lib/dates';
import { fmtDate, fmtDateTime, fmtMoney, fmtMoney0 } from '@/lib/format';
import { newId } from '@/lib/utils';
import { CASH_269ST_LIMIT } from '@/shared/constants';
import { OFFLINE_PAYMENT_MODES, PAYMENT_MODES, PAYMENT_STATUSES } from '@/shared/enums';
import { offlinePaymentBody, verifyNotificationBody } from '@/shared/schemas/billing';
import {
  ALL,
  adminApi,
  adminDownload,
  check,
  ClientSelect,
  enumOptions,
  errorsOf,
  Fact,
  FilterBar,
  labelize,
  MoneyCell,
  NameCell,
  ReasonDialog,
  toastError,
  useA,
  useAList,
  useListState,
  useRun,
  withAll,
} from './kit';
import type { AdminInvoice, AdminNotification, AdminPayment } from './types';

type Tab = 'payments' | 'notifications';

/** /admin/payments — payments (OFF-01…08) and “I have paid” notifications (CA-12). */
export function PaymentsView() {
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>(sp.get('tab') === 'notifications' ? 'notifications' : 'payments');
  const pending = useA<AdminNotification[]>('/payment-notifications', { status: 'pending' });
  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Razorpay, bank transfers, cheques and cash — every rupee received"
        actions={
          <Button asChild>
            <Link href="/admin/payments/record">
              <Banknote /> Record payment
            </Link>
          </Button>
        }
      />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'payments', label: 'Payments' },
          { value: 'notifications', label: '“I have paid”', count: pending.data?.length },
        ]}
      />
      {tab === 'payments' ? <PaymentsList /> : <NotificationsList />}
    </>
  );
}

function PaymentsList() {
  const sp = useSearchParams();
  const l = useListState({
    clientId: undefined as string | undefined,
    mode: ALL as string,
    status: sp.get('status') ?? ALL,
    needsReview: sp.get('needsReview') ?? ALL,
  });
  const [range, setRange] = useState<DateRange>({ from: addDays(todayIST(), -365), to: todayIST() });
  const q = useAList<AdminPayment>('/payments', { ...l.query, ...range });
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <FilterBar>
        <ClientSelect all className="w-56" value={l.filters.clientId} onChange={(v) => l.set('clientId', v)} />
        <Select
          className="w-36"
          size="sm"
          aria-label="Mode"
          value={l.filters.mode}
          onValueChange={(v) => l.set('mode', v)}
          options={withAll('Any mode', enumOptions(PAYMENT_MODES))}
        />
        <Select
          className="w-44"
          size="sm"
          aria-label="Status"
          value={l.filters.status}
          onValueChange={(v) => l.set('status', v)}
          options={withAll('Any status', enumOptions(PAYMENT_STATUSES))}
        />
        <Select
          className="w-40"
          size="sm"
          aria-label="Review"
          value={l.filters.needsReview}
          onValueChange={(v) => l.set('needsReview', v)}
          options={withAll('Reviewed or not', [{ value: 'true', label: 'Needs review' }])}
        />
        <DateRangePicker value={range} onChange={setRange} max={todayIST()} />
      </FilterBar>
      <Card>
        <DataTable
          loading={q.isLoading}
          rows={q.data?.items}
          rowKey={(p) => p.id}
          onRowClick={(p) => setOpen(p.id)}
          empty="No payments match."
          columns={[
            {
              key: 'd',
              header: 'Date',
              cell: (p) => <span className="text-xs whitespace-nowrap">{fmtDate(p.paymentDate)}</span>,
            },
            {
              key: 'c',
              header: 'Client',
              cell: (p) => <NameCell name={p.clientName} sub={p.receiptNo ? `Receipt ${p.receiptNo}` : undefined} />,
            },
            {
              key: 'm',
              header: 'Mode',
              hideBelow: 'md',
              cell: (p) => <NameCell name={labelize(p.mode)} sub={p.reference} />,
            },
            { key: 'a', header: 'Amount', align: 'right', cell: (p) => <MoneyCell v={p.amount} strong /> },
            {
              key: 's',
              header: 'Status',
              cell: (p) => (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={p.status} size="sm" />
                  {p.needsReview && (
                    <Badge size="sm" tone="warning">
                      Review
                    </Badge>
                  )}
                </div>
              ),
            },
          ]}
        />
        {q.data && (
          <Pagination page={l.page} pageSize={l.pageSize} total={q.data.meta.total} onPageChange={l.setPage} />
        )}
      </Card>
      {open && <PaymentDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

type PayDlg = 'clear' | 'bounce' | 'reverse' | 'reviewed' | 'alloc';
function PaymentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useA<AdminPayment>(`/payments/${id}`);
  const [dlg, setDlg] = useState<PayDlg | null>(null);
  const [charge, setCharge] = useState('');
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const { run, busy } = useRun();
  const p = q.data;
  async function proof(f: File | undefined) {
    if (!f || !p) return;
    const form = new FormData();
    form.append('file', f);
    await run('proof', () => adminApi.upload(`/payments/${p.id}/proof`, form), 'Proof uploaded').catch(toastError);
  }
  const cheque = p?.status === 'pending_clearance';
  const done = p?.status === 'bounced' || p?.status === 'reversed';
  return (
    <Drawer
      open
      width="lg"
      onOpenChange={(o) => !o && onClose()}
      title={p ? `${fmtMoney(p.amount)} · ${labelize(p.mode)}` : 'Payment'}
      description={p && `${p.clientName} · ${fmtDate(p.paymentDate)}`}
      footer={
        p && (
          <div className="flex w-full flex-wrap gap-2">
            {cheque && (
              <>
                <Button onClick={() => setDlg('clear')}>
                  <CheckCircle2 /> Cheque cleared
                </Button>
                <Button variant="danger-soft" onClick={() => setDlg('bounce')}>
                  <Ban /> Bounced
                </Button>
              </>
            )}
            {p.needsReview && (
              <Button variant="secondary" onClick={() => setDlg('reviewed')}>
                <ClipboardCheck /> Mark reviewed
              </Button>
            )}
            {!done && p.status === 'applied' && (
              <Button variant="secondary" onClick={() => setDlg('alloc')}>
                <ListChecks /> Allocation
              </Button>
            )}
            {!done && (
              <Button variant="danger-soft" className="ml-auto" onClick={() => setDlg('reverse')}>
                <RotateCcw /> Reverse
              </Button>
            )}
          </div>
        )
      }
    >
      {!p ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={p.status} />
            <Badge tone="neutral">{labelize(p.source)}</Badge>
            {p.needsReview && <Badge tone="warning">Needs review: {p.reviewNote}</Badge>}
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Fact label="Reference">{p.reference}</Fact>
            <Fact label="Bank">{p.bank}</Fact>
            <Fact label="Cheque date">{fmtDate(p.chequeDate)}</Fact>
            <Fact label="Gateway fee">{p.gatewayFee ? fmtMoney(p.gatewayFee) : '—'}</Fact>
            <Fact label="Cleared">{fmtDate(p.clearedAt)}</Fact>
            <Fact label="Recorded">{fmtDateTime(p.createdAt)}</Fact>
            {p.bounceReason && (
              <Fact label="Bounce reason" className="sm:col-span-3">
                {p.bounceReason}
              </Fact>
            )}
            {p.reverseReason && (
              <Fact label="Reverse reason" className="sm:col-span-3">
                {p.reverseReason}
              </Fact>
            )}
            {p.overrideReason && (
              <Fact label="Cash limit override" className="sm:col-span-3">
                {p.overrideReason}
              </Fact>
            )}
            {p.remarks && (
              <Fact label="Remarks" className="sm:col-span-3">
                {p.remarks}
              </Fact>
            )}
          </div>
          <Card padded={false} className="p-4">
            <CardHeader title="Applied to" className="mb-2" />
            <DataTable
              dense
              rows={p.allocations ?? []}
              rowKey={(a) => a.invoiceId}
              empty="Not allocated — kept as client credit."
              columns={[
                {
                  key: 'i',
                  header: 'Invoice',
                  cell: (a) => (
                    <Link className="text-brand-500 font-medium" href={`/admin/invoices/${a.invoiceId}`}>
                      {a.invoiceNo ?? 'Invoice'}
                    </Link>
                  ),
                },
                { key: 'a', header: 'Amount', align: 'right', cell: (a) => <MoneyCell v={a.amount} strong /> },
              ]}
            />
          </Card>
          <div className="flex flex-wrap gap-2">
            {p.receiptId && (
              <Button variant="secondary" size="sm" onClick={() => void adminDownload(`/receipts/${p.receiptId}/pdf`)}>
                <Receipt /> Receipt {p.receiptNo}
              </Button>
            )}
            {p.proofUploaded && (
              <Button variant="secondary" size="sm" onClick={() => void adminDownload(`/payments/${p.id}/proof`)}>
                <Eye /> View proof
              </Button>
            )}
            <input
              ref={file}
              hidden
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => void proof(e.target.files?.[0])}
            />
            <Button variant="ghost" size="sm" loading={busy === 'proof'} onClick={() => file.current?.click()}>
              <FileUp /> {p.proofUploaded ? 'Replace proof' : 'Upload proof'}
            </Button>
          </div>
        </div>
      )}
      {p && dlg === 'clear' && (
        <ReasonDialog
          open
          noReason
          tone="success"
          dateLabel="Cleared on"
          dateRequired
          title="Cheque cleared"
          confirm="Apply payment"
          description="The amount is applied to the invoices and a receipt is issued."
          onClose={() => setDlg(null)}
          onConfirm={({ date }) =>
            run('clear', () => adminApi.post(`/payments/${p.id}/clear`, { clearedOn: date }), 'Cheque cleared')
          }
        />
      )}
      {p && dlg === 'bounce' && (
        <ReasonDialog
          open
          tone="danger"
          dateLabel="Bounced on"
          dateRequired
          title="Cheque bounced"
          confirm="Mark bounced"
          onClose={() => setDlg(null)}
          onConfirm={({ date, reason }) =>
            run(
              'bounce',
              () =>
                adminApi.post(`/payments/${p.id}/bounce`, {
                  bouncedOn: date,
                  reason,
                  ...(charge.trim() ? { chargeAmount: charge.trim() } : {}),
                }),
              'Marked as bounced',
            )
          }
        >
          <Field label="Bounce charge (₹)" hint="Optional — billed on a manual invoice">
            <Input inputMode="decimal" value={charge} onChange={(e) => setCharge(e.target.value)} />
          </Field>
        </ReasonDialog>
      )}
      {p && dlg === 'reverse' && (
        <ReasonDialog
          open
          tone="danger"
          title="Reverse payment"
          description="Removes the payment from the invoices (e.g. entered twice). The receipt is cancelled."
          confirm="Reverse"
          onClose={() => setDlg(null)}
          onConfirm={({ reason }) =>
            run('reverse', () => adminApi.post(`/payments/${p.id}/reverse`, { reason }), 'Payment reversed')
          }
        />
      )}
      {p && dlg === 'reviewed' && (
        <ReasonDialog
          open
          noReason
          tone="success"
          title="Mark as reviewed"
          confirm="Save"
          onClose={() => setDlg(null)}
          onConfirm={async () => {
            if (note.trim().length < 3) throw new Error('Write a short note');
            await run(
              'reviewed',
              () => adminApi.post(`/payments/${p.id}/reviewed`, { note: note.trim() }),
              'Marked as reviewed',
            );
          }}
        >
          <Field label="Note" required>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </ReasonDialog>
      )}
      {p && dlg === 'alloc' && <AllocationDialog payment={p} onClose={() => setDlg(null)} />}
    </Drawer>
  );
}

/** Open invoices of one client with an amount box each; empty = oldest first (OFF-04). */
function useOpenInvoices(clientId: string | undefined) {
  const q = useAList<AdminInvoice>('/invoices', { clientId, page: 1, pageSize: 100 });
  return clientId
    ? (q.data?.items ?? []).filter((i) => Number(i.balance) > 0 && !['draft', 'cancelled'].includes(i.status))
    : [];
}
function AllocationEditor({
  invoices,
  value,
  onChange,
}: {
  invoices: AdminInvoice[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  if (invoices.length === 0)
    return <p className="text-ink-400 text-sm">No open invoices — the amount stays as credit.</p>;
  return (
    <ul className="rounded-inner border-line divide-line divide-y border">
      {invoices.map((i) => (
        <li key={i.id} className="flex items-center gap-3 px-3 py-2">
          <NameCell name={i.number ?? 'Invoice'} sub={`Due ${fmtDate(i.dueDate)} · balance ${fmtMoney(i.balance)}`} />
          <Input
            className="ml-auto w-36"
            inputMode="decimal"
            aria-label={`Amount for ${i.number}`}
            value={value[i.id] ?? ''}
            onChange={(e) => onChange({ ...value, [i.id]: e.target.value })}
          />
        </li>
      ))}
    </ul>
  );
}
const toAllocations = (v: Record<string, string>) =>
  Object.entries(v)
    .filter(([, a]) => a.trim() && Number(a) > 0)
    .map(([invoiceId, amount]) => ({ invoiceId, amount: amount.trim() }));

function AllocationDialog({ payment, onClose }: { payment: AdminPayment; onClose: () => void }) {
  const invoices = useOpenInvoices(payment.clientId);
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries((payment.allocations ?? []).map((a) => [a.invoiceId, a.amount])),
  );
  const { run, busy } = useRun();
  const current = (payment.allocations ?? []).map(
    (a) => ({ id: a.invoiceId, number: a.invoiceNo, balance: '0', dueDate: null }) as unknown as AdminInvoice,
  );
  const list = [...current, ...invoices.filter((i) => !current.some((c) => c.id === i.id))];
  return (
    <Modal
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title="Change allocation"
      description={`${fmtMoney(payment.amount)} — what is not allocated becomes client credit`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy === 'alloc'}
            onClick={() =>
              void run(
                'alloc',
                () => adminApi.put(`/payments/${payment.id}/allocations`, { allocations: toAllocations(v) }),
                'Allocation saved',
              )
                .then(onClose)
                .catch(toastError)
            }
          >
            Save
          </Button>
        </>
      }
    >
      <AllocationEditor invoices={list} value={v} onChange={setV} />
    </Modal>
  );
}

// ---------------------------------------------------------------- record payment

/** /admin/payments/record — offline payment (OFF-01…04) with optional proof. */
export function RecordPayment() {
  const router = useRouter();
  const [f, setF] = useState({
    clientId: undefined as string | undefined,
    mode: 'neft',
    amount: '',
    paymentDate: todayIST() as string | null,
    reference: '',
    bank: '',
    chequeDate: null as string | null,
    remarks: '',
    overrideReason: '',
  });
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [key] = useState(newId);
  const invoices = useOpenInvoices(f.clientId);
  const { run, busy } = useRun();
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const overCash = f.mode === 'cash' && Number(f.amount) >= CASH_269ST_LIMIT;
  const allocated = toAllocations(alloc).reduce((s, a) => s + Number(a.amount), 0);

  async function save() {
    const t = (s: string) => s.trim() || undefined;
    const allocations = toAllocations(alloc);
    const v = check(offlinePaymentBody, {
      clientId: f.clientId,
      mode: f.mode,
      amount: f.amount.trim(),
      paymentDate: f.paymentDate,
      reference: t(f.reference),
      bank: t(f.bank),
      chequeDate: f.chequeDate ?? undefined,
      remarks: t(f.remarks),
      ...(allocations.length ? { allocations } : {}),
      overrideReason: t(f.overrideReason),
    });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    try {
      const r = await run(
        'save',
        () => adminApi.post<{ id: string }>('/payments', v.data, { idempotencyKey: key }),
        f.mode === 'cheque'
          ? 'Cheque recorded — mark it cleared when the bank confirms'
          : 'Payment recorded and receipt issued',
      );
      if (r && proof) {
        const form = new FormData();
        form.append('file', proof);
        await adminApi.upload(`/payments/${r.id}/proof`, form).catch(toastError);
      }
      router.push('/admin/payments');
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Record a payment"
        subtitle="Bank transfer, UPI, cheque or cash — Razorpay payments arrive by themselves"
        crumbs={[{ label: 'Payments', href: '/admin/payments' }, { label: 'Record' }]}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client" required error={errors.clientId} className="sm:col-span-2">
              <ClientSelect
                value={f.clientId}
                onChange={(v) => {
                  set('clientId', v);
                  setAlloc({});
                }}
                invalid={!!errors.clientId}
              />
            </Field>
            <Field label="Mode" required className="sm:col-span-2">
              <Segmented
                value={f.mode}
                onChange={(v) => set('mode', v)}
                items={OFFLINE_PAYMENT_MODES.map((m) => ({
                  value: m,
                  label: m === 'neft' || m === 'rtgs' || m === 'imps' || m === 'upi' ? m.toUpperCase() : labelize(m),
                }))}
              />
            </Field>
            <Field label="Amount (₹)" required error={errors.amount}>
              <Input
                inputMode="decimal"
                value={f.amount}
                onChange={(e) => set('amount', e.target.value)}
                invalid={!!errors.amount}
              />
            </Field>
            <Field label={f.mode === 'cheque' ? 'Received on' : 'Paid on'} required error={errors.paymentDate}>
              <DateField value={f.paymentDate} onChange={(d) => set('paymentDate', d)} max={todayIST()} />
            </Field>
            <Field
              label={f.mode === 'cheque' ? 'Cheque no.' : 'Reference (UTR / UPI ref)'}
              required={f.mode !== 'cash'}
              error={errors.reference}
            >
              <Input
                value={f.reference}
                onChange={(e) => set('reference', e.target.value)}
                invalid={!!errors.reference}
              />
            </Field>
            <Field label="Bank" required={f.mode === 'cheque'} error={errors.bank}>
              <Input value={f.bank} onChange={(e) => set('bank', e.target.value)} />
            </Field>
            {f.mode === 'cheque' && (
              <Field label="Cheque date" required error={errors.chequeDate}>
                <DateField value={f.chequeDate} onChange={(d) => set('chequeDate', d)} />
              </Field>
            )}
            <Field label="Remarks" className="sm:col-span-2">
              <Input value={f.remarks} onChange={(e) => set('remarks', e.target.value)} />
            </Field>
            {overCash && (
              <div className="rounded-inner bg-warning-50 space-y-3 p-3 sm:col-span-2">
                <p className="text-warning-600 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="size-4" /> Cash of {fmtMoney0(CASH_269ST_LIMIT)} or more breaks section
                  269ST.
                </p>
                <Field label="Override reason" required error={errors.overrideReason}>
                  <Input value={f.overrideReason} onChange={(e) => set('overrideReason', e.target.value)} />
                </Field>
              </div>
            )}
            <Field label="Proof (optional)" hint="Bank advice, cheque photo…" className="sm:col-span-2">
              <Input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              />
            </Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Apply to invoices" subtitle="Leave empty to settle the oldest invoices first" />
          {f.clientId ? (
            <AllocationEditor invoices={invoices} value={alloc} onChange={setAlloc} />
          ) : (
            <p className="text-ink-400 text-sm">Choose a client first.</p>
          )}
          {errors.allocations && <p className="text-danger-600 mt-2 text-xs">{errors.allocations}</p>}
          <div className="border-line mt-5 flex items-center justify-between border-t pt-4 text-sm">
            <span className="text-ink-500">Allocated</span>
            <span className="tabular text-ink-900 font-semibold">
              {fmtMoney(allocated)} / {fmtMoney(Number(f.amount) || 0)}
            </span>
          </div>
          <Button block className="mt-5" onClick={save} loading={busy === 'save'}>
            <Banknote /> Record payment
          </Button>
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- “I have paid” notifications

function NotificationsList() {
  const [status, setStatus] = useState<'pending' | 'verified' | 'rejected'>('pending');
  const q = useA<AdminNotification[]>('/payment-notifications', { status });
  const [verify, setVerify] = useState<AdminNotification | null>(null);
  const [reject, setReject] = useState<AdminNotification | null>(null);
  const [note, setNote] = useState('');
  const { run } = useRun();
  return (
    <Card>
      <CardHeader
        title="Payments told by clients"
        subtitle="Check your bank statement, then verify (creates the payment and receipt) or reject"
        action={
          <Segmented
            size="sm"
            value={status}
            onChange={setStatus}
            items={[
              { value: 'pending', label: 'To check' },
              { value: 'verified', label: 'Verified' },
              { value: 'rejected', label: 'Rejected' },
            ]}
          />
        }
      />
      <DataTable
        loading={q.isLoading}
        rows={q.data}
        rowKey={(n) => n.id}
        empty="Nothing here."
        columns={[
          { key: 'd', header: 'Paid on', cell: (n) => <span className="text-xs">{fmtDate(n.paidOn)}</span> },
          { key: 'c', header: 'Client', cell: (n) => <NameCell name={n.clientName} sub={`Invoice ${n.invoiceNo}`} /> },
          {
            key: 'r',
            header: 'Reference',
            hideBelow: 'md',
            cell: (n) => <span className="tabular text-xs">{n.reference}</span>,
          },
          { key: 'a', header: 'Amount', align: 'right', cell: (n) => <MoneyCell v={n.amount} strong /> },
          {
            key: 'x',
            header: '',
            align: 'right',
            cell: (n) => (
              <div className="flex justify-end gap-1">
                {n.proofUploaded && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Proof"
                    onClick={() => void adminDownload(`/payment-notifications/${n.id}/proof`)}
                  >
                    <Download />
                  </Button>
                )}
                {n.status === 'pending' ? (
                  <>
                    <Button size="sm" variant="soft" onClick={() => setVerify(n)}>
                      <CheckCircle2 /> Verify
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setReject(n)}>
                      <XCircle /> Reject
                    </Button>
                  </>
                ) : (
                  <span className="text-ink-400 text-xs">{n.note}</span>
                )}
              </div>
            ),
          },
        ]}
      />
      {verify && <VerifyDialog n={verify} onClose={() => setVerify(null)} />}
      {reject && (
        <ReasonDialog
          open
          noReason
          tone="danger"
          title="Reject notification"
          description="The client sees your note."
          confirm="Reject"
          onClose={() => setReject(null)}
          onConfirm={async () => {
            if (note.trim().length < 3) throw new Error('Write a short note for the client');
            await run(
              'reject',
              () => adminApi.post(`/payment-notifications/${reject.id}/reject`, { note: note.trim() }),
              'Rejected',
            );
            setNote('');
          }}
        >
          <Field label="Note to the client" required>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </ReasonDialog>
      )}
    </Card>
  );
}

function VerifyDialog({ n, onClose }: { n: AdminNotification; onClose: () => void }) {
  const [mode, setMode] = useState('neft');
  const { run, busy } = useRun();
  async function go() {
    const v = check(verifyNotificationBody, { mode, allocations: [{ invoiceId: n.invoiceId, amount: n.amount }] });
    if (!v.ok) return toastError(new Error(Object.values(v.errors)[0]));
    await run(
      'verify',
      () => adminApi.post(`/payment-notifications/${n.id}/verify`, v.data),
      'Verified — payment and receipt created',
    )
      .then(onClose)
      .catch(toastError);
  }
  return (
    <Modal
      open
      tone="success"
      onOpenChange={(o) => !o && onClose()}
      title="Verify payment"
      description={`${n.clientName} · ${fmtMoney(n.amount)} on ${fmtDate(n.paidOn)} · ref ${n.reference}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy === 'verify'}>
            Verify
          </Button>
        </>
      }
    >
      <Field label="Received by">
        <Select
          value={mode}
          onValueChange={setMode}
          options={['neft', 'rtgs', 'imps', 'upi', 'other'].map((m) => ({
            value: m,
            label: m === 'other' ? 'Other' : m.toUpperCase(),
          }))}
        />
      </Field>
      <p className="text-ink-500 mt-3 text-sm">
        The amount is applied to invoice {n.invoiceNo}; any excess becomes client credit.
      </p>
    </Modal>
  );
}
