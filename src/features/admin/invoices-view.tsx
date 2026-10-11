'use client';

import {
  BadgeIndianRupee,
  Download,
  FileArchive,
  FilePlus2,
  FileText,
  Link2,
  MinusCircle,
  Plus,
  Send,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { DateField } from '@/components/date/date-field';
import { StatCard } from '@/components/data/stat-card';
import { PageHeader } from '@/components/shell/page-header';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardMenu } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, SearchInput, Textarea } from '@/components/ui/input';
import { CopyButton, EmptyState, Skeleton, Switch } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { DataTable, Pagination } from '@/components/ui/table';
import { fyLabel, todayIST } from '@/lib/dates';
import { fmtDate, fmtMoney, fmtMoney0, fmtNum } from '@/lib/format';
import { newId } from '@/lib/utils';
import { INVOICE_STATUSES } from '@/shared/enums';
import { adminTdsBody, cancelInvoiceBody, creditNoteBody, manualInvoiceBody } from '@/shared/schemas/billing';
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
import type { AdminInvoiceDetail, AdminInvoice, AdminPlant } from './types';

const fyOptions = () => {
  const y = Number(fyLabel(todayIST()).slice(0, 4));
  return [0, 1, 2, 3].map((i) => {
    const s = y - i;
    const v = `${s}-${String((s + 1) % 100).padStart(2, '0')}`;
    return { value: v, label: `FY ${v}` };
  });
};

/** /admin/invoices (INV-01…14) */
export function InvoicesList() {
  const router = useRouter();
  const sp = useSearchParams();
  const l = useListState({
    clientId: (sp.get('clientId') ?? undefined) as string | undefined,
    status: sp.get('status') ?? ALL,
    fy: ALL as string,
    overdueDays: ALL as string,
  });
  const q = useAList<AdminInvoice>('/invoices', l.query);
  const { busy, run } = useRun();
  const zip = () =>
    run('zip', () =>
      adminApi.download('/invoices/zip', {
        method: 'POST',
        body: {
          clientId: l.filters.clientId,
          fy: l.filters.fy === ALL ? undefined : l.filters.fy,
          status: l.filters.status === ALL ? undefined : l.filters.status,
        },
        fallbackName: 'invoices.zip',
      }),
    ).catch(toastError);
  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Tax invoices of all clients, with GST split, payments, TDS and credit notes"
        actions={
          <>
            <Button variant="secondary" onClick={zip} loading={busy === 'zip'}>
              <FileArchive /> PDFs as ZIP
            </Button>
            <Button asChild>
              <Link href="/admin/invoices/new">
                <FilePlus2 /> Manual invoice
              </Link>
            </Button>
          </>
        }
      />
      <FilterBar>
        <SearchInput
          className="w-full sm:w-56"
          placeholder="Invoice no. or client…"
          value={l.q}
          onChange={(e) => l.search(e.target.value)}
        />
        <ClientSelect all className="w-56" value={l.filters.clientId} onChange={(v) => l.set('clientId', v)} />
        <Select
          className="w-40"
          size="sm"
          aria-label="Status"
          value={l.filters.status}
          onValueChange={(v) => l.set('status', v)}
          options={withAll('Any status', enumOptions(INVOICE_STATUSES))}
        />
        <Select
          className="w-36"
          size="sm"
          aria-label="Financial year"
          value={l.filters.fy}
          onValueChange={(v) => l.set('fy', v)}
          options={withAll('Any FY', fyOptions())}
        />
        <Select
          className="w-44"
          size="sm"
          aria-label="Overdue"
          value={l.filters.overdueDays}
          onValueChange={(v) => l.set('overdueDays', v)}
          options={withAll(
            'Overdue: any',
            ['1', '30', '60', '90'].map((d) => ({ value: d, label: `Overdue ${d}+ days` })),
          )}
        />
      </FilterBar>
      <Card>
        <DataTable
          loading={q.isLoading}
          rows={q.data?.items}
          rowKey={(i) => i.id}
          onRowClick={(i) => router.push(`/admin/invoices/${i.id}`)}
          empty="No invoices match."
          columns={[
            {
              key: 'n',
              header: 'Invoice',
              cell: (i) => <NameCell name={i.number ?? 'Draft'} sub={labelize(i.kind)} />,
            },
            { key: 'c', header: 'Client', cell: (i) => <NameCell name={i.clientName} sub={i.plants} /> },
            {
              key: 'd',
              header: 'Date / due',
              hideBelow: 'md',
              cell: (i) => (
                <NameCell name={fmtDate(i.issueDate)} sub={i.dueDate ? `due ${fmtDate(i.dueDate)}` : undefined} />
              ),
            },
            { key: 't', header: 'Total', align: 'right', cell: (i) => <MoneyCell v={i.total} strong /> },
            {
              key: 'b',
              header: 'Balance',
              align: 'right',
              hideBelow: 'sm',
              cell: (i) => <MoneyCell v={i.balance} tone={Number(i.balance) > 0 ? 'danger' : undefined} />,
            },
            { key: 's', header: 'Status', cell: (i) => <StatusBadge status={i.status} size="sm" /> },
          ]}
        />
        {q.data && (
          <Pagination page={l.page} pageSize={l.pageSize} total={q.data.meta.total} onPageChange={l.setPage} />
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------- detail

type InvDlg = 'cancel' | 'cn' | 'tds' | 'issue';
/** /admin/invoices/:id */
export function InvoiceDetail({ id }: { id: string }) {
  const q = useA<AdminInvoiceDetail>(`/invoices/${id}`);
  const [dlg, setDlg] = useState<InvDlg | null>(null);
  const { run } = useRun();
  const i = q.data;
  if (q.error) return <EmptyState title="Invoice not found" />;
  if (!i) return <Skeleton className="rounded-card h-[520px]" />;
  const draft = i.status === 'draft';
  const open = !['cancelled', 'paid', 'written_off', 'draft'].includes(i.status);
  const tdsSum = i.tds.reduce((s, t) => s + Number(t.amount), 0);
  const igst = i.gstType === 'igst';
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Invoices', href: '/admin/invoices' }, { label: i.number ?? 'Draft' }]}
        title={i.number ?? 'Draft invoice'}
        badge={<StatusBadge status={i.status} />}
        subtitle={
          <>
            <Link className="text-brand-500" href={`/admin/clients/${i.clientId}`}>
              {i.clientName}
            </Link>
            {i.plants ? ` · ${i.plants}` : ''} · {labelize(i.kind)}
          </>
        }
        actions={
          <>
            {draft ? (
              <Button onClick={() => setDlg('issue')}>
                <Zap /> Issue now
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => void adminDownload(`/invoices/${i.id}/pdf`)}
                disabled={!i.pdfReady}
              >
                <Download /> PDF
              </Button>
            )}
            <CardMenu
              items={[
                {
                  label: 'Re-send e-mail',
                  icon: <Send className="size-4" />,
                  disabled: draft || i.status === 'cancelled',
                  onSelect: () =>
                    void run('resend', () => adminApi.post(`/invoices/${i.id}/resend`), 'Invoice e-mailed again').catch(
                      toastError,
                    ),
                },
                {
                  label: 'New payment link',
                  icon: <Link2 className="size-4" />,
                  disabled: !open,
                  onSelect: () =>
                    void run(
                      'link',
                      () => adminApi.post(`/invoices/${i.id}/pay-link/refresh`),
                      'New payment link created',
                    ).catch(toastError),
                },
                {
                  label: 'Record TDS',
                  icon: <BadgeIndianRupee className="size-4" />,
                  disabled: draft || i.status === 'cancelled',
                  onSelect: () => setDlg('tds'),
                },
                {
                  label: 'Credit note',
                  icon: <MinusCircle className="size-4" />,
                  disabled: draft || i.status === 'cancelled',
                  onSelect: () => setDlg('cn'),
                },
                {
                  label: 'Cancel invoice',
                  icon: <XCircle className="size-4" />,
                  danger: true,
                  disabled: i.status === 'cancelled',
                  onSelect: () => setDlg('cancel'),
                },
              ]}
            />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" icon={<FileText />} value={Number(i.total)} format={fmtMoney} />
        <StatCard
          title="Paid"
          icon={<BadgeIndianRupee />}
          iconTone="success"
          value={Number(i.paid) + Number(i.advanceAdjusted)}
          format={fmtMoney}
          caption={Number(i.advanceAdjusted) > 0 ? `${fmtMoney(i.advanceAdjusted)} from credit` : undefined}
        />
        <StatCard
          title="TDS & credit notes"
          icon={<MinusCircle />}
          iconTone="purple"
          value={tdsSum + Number(i.creditNoted)}
          format={fmtMoney}
        />
        <StatCard
          title="Balance"
          icon={<XCircle />}
          iconTone={Number(i.balance) > 0 ? 'danger' : 'success'}
          value={Number(i.balance)}
          format={fmtMoney}
          caption={i.dueDate ? `Due ${fmtDate(i.dueDate)}` : undefined}
        />
      </div>
      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Lines"
              subtitle={`${igst ? 'IGST' : 'CGST + SGST'} ${i.gstRatePct}% · place of supply ${i.placeOfSupply ?? '—'}`}
            />
            <DataTable
              dense
              rows={i.lines}
              rowKey={(l) => l.id}
              columns={[
                {
                  key: 'd',
                  header: 'Description',
                  cell: (l) => <NameCell name={l.description} sub={l.sac ? `SAC ${l.sac}` : undefined} />,
                },
                { key: 'q', header: 'Qty', align: 'right', cell: (l) => fmtNum(Number(l.qty), 2) },
                { key: 'r', header: 'Rate', align: 'right', cell: (l) => <MoneyCell v={l.rate} /> },
                { key: 't', header: 'Taxable', align: 'right', cell: (l) => <MoneyCell v={l.taxable} strong /> },
              ]}
            />
            <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
              {[
                ['Taxable', i.taxable],
                ...(igst
                  ? [['IGST', i.igst]]
                  : [
                      ['CGST', i.cgst],
                      ['SGST', i.sgst],
                    ]),
                ['Round off', i.roundOff],
                ['Total', i.total],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className={
                    k === 'Total'
                      ? 'text-ink-900 border-line flex justify-between border-t pt-2 font-semibold'
                      : 'text-ink-500 flex justify-between'
                  }
                >
                  <dt>{k}</dt>
                  <dd className="tabular">{fmtMoney(v)}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Payments" />
            <DataTable
              dense
              rows={i.payments}
              rowKey={(p) => p.paymentId}
              empty="No payments yet."
              columns={[
                { key: 'd', header: 'Date', cell: (p) => <span className="text-xs">{fmtDate(p.paymentDate)}</span> },
                { key: 'm', header: 'Mode', cell: (p) => <NameCell name={labelize(p.mode)} sub={p.reference} /> },
                { key: 's', header: 'Status', cell: (p) => <StatusBadge status={p.status} size="sm" /> },
                { key: 'a', header: 'Applied', align: 'right', cell: (p) => <MoneyCell v={p.amount} strong /> },
                { key: 'r', header: 'Receipt', hideBelow: 'md', cell: (p) => p.receiptNo ?? '—' },
              ]}
            />
          </Card>
          <Card>
            <CardHeader title="TDS" subtitle={`${fmtMoney(tdsSum)} recorded`} />
            <DataTable
              dense
              rows={i.tds}
              rowKey={(t) => t.id}
              empty="No TDS recorded."
              columns={[
                {
                  key: 'd',
                  header: 'Deducted on',
                  cell: (t) => <span className="text-xs">{fmtDate(t.deductionDate)}</span>,
                },
                { key: 's', header: 'Section', cell: (t) => t.section },
                { key: 'a', header: 'Amount', align: 'right', cell: (t) => <MoneyCell v={t.amount} /> },
                {
                  key: 'v',
                  header: 'Status',
                  cell: (t) => (
                    <div className="flex flex-wrap gap-1">
                      <Badge size="sm" tone={t.verified ? 'success' : 'warning'}>
                        {t.verified ? 'Verified' : 'To verify'}
                      </Badge>
                      <Badge size="sm" tone={t.certificateStatus === 'received' ? 'success' : 'neutral'}>
                        Form 16A {t.certificateStatus}
                      </Badge>
                      {t.enteredByClient && (
                        <Badge size="sm" tone="brand">
                          By client
                        </Badge>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <div className="grid grid-cols-2 gap-4">
              <Fact label="Issued">{fmtDate(i.issueDate)}</Fact>
              <Fact label="Due">{fmtDate(i.dueDate)}</Fact>
              <Fact label="FY">{i.fy}</Fact>
              <Fact label="Created">{fmtDate(i.createdAt)}</Fact>
              {i.cancelReason && (
                <Fact label="Cancelled because" className="col-span-2">
                  <span className="whitespace-normal">{i.cancelReason}</span>
                </Fact>
              )}
              {i.notes && (
                <Fact label="Notes" className="col-span-2">
                  <span className="whitespace-normal">{i.notes}</span>
                </Fact>
              )}
            </div>
            {i.payUrl && open && (
              <div className="rounded-inner bg-canvas mt-4 flex items-center justify-between gap-2 p-3 text-xs">
                <span className="text-ink-700 truncate">{i.payUrl}</span>
                <CopyButton value={i.payUrl} label="Copy pay link" />
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Credit notes" />
            {i.creditNotes.length === 0 ? (
              <p className="text-ink-400 text-sm">None.</p>
            ) : (
              <ul className="divide-line divide-y">
                {i.creditNotes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <NameCell name={c.number} sub={`${fmtDate(c.date)} · ${c.reason}`} />
                    <MoneyCell v={c.total} />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Credit note PDF"
                      disabled={!c.pdfReady}
                      onClick={() => void adminDownload(`/credit-notes/${c.id}/pdf`)}
                    >
                      <Download />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {dlg === 'issue' && (
        <ReasonDialog
          open
          noReason
          tone="brand"
          title="Issue this invoice?"
          description="It gets the next invoice number, a PDF and is e-mailed to the client."
          confirm="Issue"
          onClose={() => setDlg(null)}
          onConfirm={() => run('issue', () => adminApi.post(`/invoices/${i.id}/issue`), 'Invoice issued')}
        />
      )}
      {dlg === 'cancel' && <CancelInvoiceDialog inv={i} onClose={() => setDlg(null)} />}
      {dlg === 'cn' && <CreditNoteDialog inv={i} onClose={() => setDlg(null)} />}
      {dlg === 'tds' && <TdsDialog inv={i} onClose={() => setDlg(null)} />}
    </>
  );
}

function CancelInvoiceDialog({ inv, onClose }: { inv: AdminInvoiceDetail; onClose: () => void }) {
  const [release, setRelease] = useState(false);
  const { run } = useRun();
  return (
    <ReasonDialog
      open
      tone="danger"
      title={`Cancel ${inv.number ?? 'draft'}?`}
      description={
        inv.status === 'draft'
          ? 'The draft is discarded.'
          : 'Allowed only when nothing is paid. The number stays used (GST rule).'
      }
      confirm="Cancel invoice"
      onClose={onClose}
      onConfirm={async ({ reason }) => {
        const v = check(cancelInvoiceBody, { reason, releaseSchedule: release });
        if (!v.ok) throw new Error(Object.values(v.errors)[0]);
        await run('cancel', () => adminApi.post(`/invoices/${inv.id}/cancel`, v.data), 'Invoice cancelled');
      }}
    >
      <label className="rounded-inner border-line flex items-center justify-between gap-3 border p-3">
        <span className="text-ink-900 text-sm">Put the schedule year back to “planned” (re-invoice later)</span>
        <Switch checked={release} onCheckedChange={setRelease} aria-label="Release schedule" />
      </label>
    </ReasonDialog>
  );
}

function CreditNoteDialog({ inv, onClose }: { inv: AdminInvoiceDetail; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const { run } = useRun();
  return (
    <ReasonDialog
      open
      tone="warning"
      title="Credit note"
      description={`Reduces ${inv.number}. Enter the taxable amount — GST is added like on the invoice.`}
      confirm="Create credit note"
      onClose={onClose}
      onConfirm={async ({ reason }) => {
        const v = check(creditNoteBody, { amount: amount.trim(), reason });
        if (!v.ok) throw new Error(Object.values(v.errors)[0]);
        await run('cn', () => adminApi.post(`/invoices/${inv.id}/credit-notes`, v.data), 'Credit note created');
      }}
    >
      <Field label="Taxable amount (₹)" required hint={`Invoice taxable ${fmtMoney(inv.taxable)}`}>
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
    </ReasonDialog>
  );
}

function TdsDialog({ inv, onClose }: { inv: AdminInvoiceDetail; onClose: () => void }) {
  const tax = useA<{ tdsSections?: string[] }>('/settings/tax');
  const [f, setF] = useState({
    amount: '',
    section: '194J',
    deductionDate: todayIST() as string | null,
    certificateStatus: 'pending',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, busy } = useRun();
  async function go() {
    const v = check(adminTdsBody, f);
    if (!v.ok) return setErrors(v.errors);
    try {
      await run('tds', () => adminApi.post(`/invoices/${inv.id}/tds`, v.data), 'TDS recorded');
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Record TDS"
      description={`${inv.number} · taxable ${fmtMoney(inv.taxable)} (2% = ${fmtMoney(Number(inv.taxable) * 0.02)})`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={go} loading={busy === 'tds'}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (₹)" required error={errors.amount}>
          <Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Section" required error={errors.section}>
          <Select
            value={f.section}
            onValueChange={(v) => setF({ ...f, section: v })}
            options={(tax.data?.tdsSections ?? ['194J', '194C']).map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Deducted on" required error={errors.deductionDate}>
          <DateField value={f.deductionDate} onChange={(d) => setF({ ...f, deductionDate: d })} />
        </Field>
        <Field label="Form 16A">
          <Select
            value={f.certificateStatus}
            onValueChange={(v) => setF({ ...f, certificateStatus: v })}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'received', label: 'Received' },
            ]}
          />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- manual invoice

interface Line {
  description: string;
  sac: string;
  qty: string;
  rate: string;
}
/** /admin/invoices/new — one-off invoice (setup fee, extra work…) (INV-08). */
export function ManualInvoice() {
  const router = useRouter();
  const sp = useSearchParams();
  const [clientId, setClientId] = useState<string | undefined>(sp.get('clientId') ?? undefined);
  const [plantId, setPlantId] = useState<string | undefined>();
  const plants = useAList<AdminPlant>('/plants', { clientId, page: 1, pageSize: 100 });
  const [lines, setLines] = useState<Line[]>([{ description: '', sac: '', qty: '1', rate: '' }]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [issueNow, setIssueNow] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [key] = useState(newId);
  const { run, busy } = useRun();
  const taxable = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0);
  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function save() {
    const v = check(manualInvoiceBody, {
      clientId,
      ...(plantId ? { plantId } : {}),
      lines: lines.map((l) => ({
        description: l.description.trim(),
        ...(l.sac.trim() ? { sac: l.sac.trim() } : {}),
        qty: l.qty,
        rate: l.rate.trim(),
      })),
      ...(dueDate ? { dueDate } : {}),
      issueNow,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    try {
      const r = await run(
        'save',
        () => adminApi.post<{ id: string }>('/invoices', v.data, { idempotencyKey: key }),
        issueNow ? 'Invoice issued' : 'Draft saved',
      );
      if (r) router.push(`/admin/invoices/${r.id}`);
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  return (
    <>
      <PageHeader
        title="Manual invoice"
        subtitle="GST (CGST + SGST or IGST) is worked out from the client's state"
        crumbs={[{ label: 'Invoices', href: '/admin/invoices' }, { label: 'New' }]}
      />
      <Card className="max-w-5xl">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Client" required error={errors.clientId}>
            <ClientSelect
              value={clientId}
              onChange={(v) => {
                setClientId(v);
                setPlantId(undefined);
              }}
              invalid={!!errors.clientId}
            />
          </Field>
          <Field label="Plant" hint="Optional">
            <Select
              value={plantId ?? ALL}
              onValueChange={(v) => setPlantId(v === ALL ? undefined : v)}
              disabled={!clientId}
              options={withAll(
                'No plant',
                (plants.data?.items ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.code })),
              )}
            />
          </Field>
          <Field label="Due date" hint="Empty = standard payment terms">
            <DateField value={dueDate} onChange={setDueDate} clearable min={todayIST()} />
          </Field>
        </div>
        <div className="mt-6 space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_110px_90px_150px_40px]">
              <Field label={i === 0 ? 'Description' : undefined} error={errors[`lines.${i}.description`]}>
                <Input
                  value={l.description}
                  onChange={(e) => setLine(i, 'description', e.target.value)}
                  placeholder="e.g. Setup and training"
                />
              </Field>
              <Field label={i === 0 ? 'SAC' : undefined} error={errors[`lines.${i}.sac`]}>
                <Input value={l.sac} onChange={(e) => setLine(i, 'sac', e.target.value)} placeholder="998313" />
              </Field>
              <Field label={i === 0 ? 'Qty' : undefined} error={errors[`lines.${i}.qty`]}>
                <Input inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} />
              </Field>
              <Field label={i === 0 ? 'Rate (₹)' : undefined} error={errors[`lines.${i}.rate`]}>
                <Input inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, 'rate', e.target.value)} />
              </Field>
              <Button
                className={i === 0 ? 'mt-6' : undefined}
                size="icon"
                variant="ghost"
                aria-label="Remove line"
                disabled={lines.length === 1}
                onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="soft"
            disabled={lines.length >= 20}
            onClick={() => setLines((ls) => [...ls, { description: '', sac: '', qty: '1', rate: '' }])}
          >
            <Plus /> Add line
          </Button>
        </div>
        <Field label="Notes (printed on the invoice)" className="mt-6">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="border-line mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
          <div>
            <p className="text-ink-500 text-xs">Taxable (GST added on issue)</p>
            <p className="text-ink-900 tabular text-2xl font-semibold">{fmtMoney0(taxable)}</p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={issueNow} onCheckedChange={setIssueNow} aria-label="Issue now" /> Issue now
            </label>
            <Button onClick={save} loading={busy === 'save'}>
              <FilePlus2 /> {issueNow ? 'Issue invoice' : 'Save draft'}
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}
