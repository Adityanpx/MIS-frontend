'use client';

import { useQueryClient } from '@tanstack/react-query';
import { BadgeIndianRupee, FileUp, Landmark, Receipt } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DateField } from '@/components/date/date-field';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { clientApi } from '@/lib/api';
import { todayIST } from '@/lib/dates';
import { fmtMoney } from '@/lib/format';
import { cn, newId } from '@/lib/utils';
import { clientTdsFields, paymentNotificationFields } from '@/shared/schemas/billing';
import { apiErrors, checkBody } from '../settings/queries';
import { TDS_SECTIONS, type InvoiceRef } from './billing-api';

const MAX = 5 * 1024 * 1024;

function FilePick({ file, onFile, label }: { file: File | null; onFile: (f: File | null) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className={cn(
        'rounded-inner flex w-full items-center gap-3 border border-dashed px-4 py-3 text-left transition-colors',
        file ? 'border-success-400 bg-success-50/50' : 'border-line hover:border-brand-300 hover:bg-canvas',
      )}
    >
      <FileUp className={cn('size-5', file ? 'text-success-600' : 'text-ink-400')} />
      <span className="min-w-0 flex-1">
        <span className="text-ink-900 block truncate text-sm font-medium">{file ? file.name : label}</span>
        <span className="text-ink-400 block text-xs">PDF, PNG or JPG · up to 5 MB · optional</span>
      </span>
      <input
        ref={ref}
        type="file"
        hidden
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f && f.size > MAX) return void toast.error('The file is larger than 5 MB.');
          onFile(f);
        }}
      />
    </button>
  );
}

/** CA-12 “I have paid by bank transfer” — the Super Admin verifies it before it counts. */
export function PaidDialog({ invoice, onClose }: { invoice: InvoiceRef | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ amount: '', paidOn: todayIST() as string | null, reference: '' });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  // one key per opening: a retry of the same send is de-duplicated, a new notice (e.g. a second part-payment) is not
  const [key, setKey] = useState(newId);
  const invId = invoice?.id;
  useEffect(() => {
    if (!invId) return;
    setV({ amount: '', paidOn: todayIST(), reference: '' });
    setFile(null);
    setErrors({});
    setKey(newId());
  }, [invId]);

  async function send() {
    if (!invoice) return;
    const c = checkBody(paymentNotificationFields, {
      amount: (v.amount || invoice.balance).replace(/[,\s₹]/g, ''),
      paidOn: v.paidOn,
      reference: v.reference,
    });
    if (!c.ok) return setErrors(c.errors);
    const fd = new FormData();
    fd.append('amount', c.data.amount);
    fd.append('paidOn', c.data.paidOn);
    fd.append('reference', c.data.reference);
    if (file) fd.append('file', file);
    setBusy(true);
    try {
      await clientApi.upload(`/billing/invoices/${invoice.id}/payment-notifications`, fd, { idempotencyKey: key });
      toast.success('Thank you — we will confirm the payment', {
        description: 'You get a receipt once it is verified.',
      });
      void qc.invalidateQueries({ queryKey: ['c', 'billing'] });
      onClose();
    } catch (e) {
      setErrors(apiErrors(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!invoice}
      onOpenChange={(o) => !o && !busy && onClose()}
      icon={<Landmark />}
      title="I have paid by bank transfer"
      description={invoice ? `Invoice ${invoice.number} · balance ${fmtMoney(invoice.balance)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={busy}>
            Send to accounts
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₹)" required error={errors.amount}>
            <Input
              inputMode="decimal"
              placeholder={invoice?.balance}
              value={v.amount}
              onChange={(e) => setV({ ...v, amount: e.target.value })}
            />
          </Field>
          <Field label="Paid on" required error={errors.paidOn}>
            <DateField value={v.paidOn} onChange={(d) => setV({ ...v, paidOn: d })} max={todayIST()} />
          </Field>
        </div>
        <Field label="UTR / reference" required error={errors.reference} hint="As shown in your bank statement">
          <Input value={v.reference} onChange={(e) => setV({ ...v, reference: e.target.value })} />
        </Field>
        <FilePick file={file} onFile={setFile} label="Attach the payment advice" />
      </div>
    </Modal>
  );
}

/** CA-13 TDS deducted on an invoice (+ Form 16A); counted after verification. */
export function TdsDialog({ invoice, onClose }: { invoice: InvoiceRef | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState({ amount: '', section: '194J', deductionDate: todayIST() as string | null });
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const invId = invoice?.id;
  useEffect(() => {
    if (!invId) return;
    setV({ amount: '', section: TDS_SECTIONS[0] ?? '194J', deductionDate: todayIST() });
    setFile(null);
    setErrors({});
  }, [invId]);
  const suggested = invoice ? (Number(invoice.taxable) * 0.02).toFixed(2) : '';

  async function send() {
    if (!invoice) return;
    const c = checkBody(clientTdsFields, {
      amount: (v.amount || suggested).replace(/[,\s₹]/g, ''),
      section: v.section,
      deductionDate: v.deductionDate,
    });
    if (!c.ok) return setErrors(c.errors);
    const fd = new FormData();
    fd.append('amount', c.data.amount);
    fd.append('section', c.data.section);
    fd.append('deductionDate', c.data.deductionDate);
    if (file) fd.append('file', file);
    setBusy(true);
    try {
      await clientApi.upload(`/billing/invoices/${invoice.id}/tds`, fd);
      toast.success('TDS recorded', { description: 'It reduces the balance after our accounts team verifies it.' });
      void qc.invalidateQueries({ queryKey: ['c', 'billing'] });
      onClose();
    } catch (e) {
      setErrors(apiErrors(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={!!invoice}
      onOpenChange={(o) => !o && !busy && onClose()}
      icon={<Receipt />}
      title="Record TDS"
      description={invoice ? `Invoice ${invoice.number} · taxable ${fmtMoney(invoice.taxable)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={busy}>
            <BadgeIndianRupee /> Record TDS
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="TDS amount (₹)" required error={errors.amount} hint={`2% of taxable = ₹${suggested}`}>
            <Input
              inputMode="decimal"
              placeholder={suggested}
              value={v.amount}
              onChange={(e) => setV({ ...v, amount: e.target.value })}
            />
          </Field>
          <Field label="Section" required error={errors.section}>
            <Select
              value={v.section}
              onValueChange={(section) => setV({ ...v, section })}
              options={TDS_SECTIONS.map((x) => ({
                value: x,
                label: x,
                hint: x === '194J' ? 'professional / technical' : 'contract',
              }))}
            />
          </Field>
        </div>
        <Field label="Deducted on" required error={errors.deductionDate}>
          <DateField value={v.deductionDate} onChange={(d) => setV({ ...v, deductionDate: d })} max={todayIST()} />
        </Field>
        <FilePick file={file} onFile={setFile} label="Attach Form 16A" />
      </div>
    </Modal>
  );
}
