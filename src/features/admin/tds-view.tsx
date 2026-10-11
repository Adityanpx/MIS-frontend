'use client';

import { BadgeCheck, Download, FileCheck2, FileUp, MinusCircle, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { DateRangePicker } from '@/components/date/date-range-picker';
import { StatCard } from '@/components/data/stat-card';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardMenu } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/ui/table';
import { Tabs } from '@/components/ui/tabs';
import { fyStart, todayIST, type DateRange } from '@/lib/dates';
import { fmtDate, fmtMoney } from '@/lib/format';
import {
  ALL,
  adminApi,
  adminDownload,
  ClientSelect,
  FilterBar,
  MoneyCell,
  NameCell,
  opt,
  toastError,
  useA,
  useRun,
} from './kit';
import type { AdminTds } from './types';

interface CreditNoteRow {
  id: string;
  clientId: string;
  clientName: string;
  number: string;
  date: string;
  taxable: string;
  total: string;
  reason: string;
  invoiceNo: string;
  pdfReady: boolean;
}

/** /admin/tds — TDS receivable (Form 16A) and credit notes (TDS-01…04, CN-03). */
export function TdsView() {
  const [tab, setTab] = useState<'tds' | 'cn'>('tds');
  return (
    <>
      <PageHeader
        title="TDS & credit notes"
        subtitle="Tax deducted by clients, its certificates, and every credit note issued"
      />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'tds', label: 'TDS' },
          { value: 'cn', label: 'Credit notes' },
        ]}
      />
      {tab === 'tds' ? <TdsList /> : <CreditNotes />}
    </>
  );
}

function TdsList() {
  const [clientId, setClientId] = useState<string | undefined>();
  const [verified, setVerified] = useState(ALL);
  const [cert, setCert] = useState(ALL);
  const q = useA<AdminTds[]>('/tds', { clientId, verified: opt(verified), certificateStatus: opt(cert) });
  const { run } = useRun();
  const file = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<AdminTds | null>(null);
  const rows = q.data ?? [];
  const sum = (f: (t: AdminTds) => boolean) => rows.filter(f).reduce((s, t) => s + Number(t.amount), 0);
  const patch = (t: AdminTds, body: Record<string, unknown>, ok: string) =>
    run('patch', () => adminApi.patch(`/tds/${t.id}`, body), ok).catch(toastError);
  async function upload(f: File | undefined) {
    if (!f || !target) return;
    const form = new FormData();
    form.append('file', f);
    await run('cert', () => adminApi.upload(`/tds/${target.id}/certificate`, form), 'Certificate uploaded').catch(
      toastError,
    );
    setTarget(null);
  }
  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="TDS in this list"
          icon={<MinusCircle />}
          value={sum(() => true)}
          format={fmtMoney}
          loading={q.isLoading}
        />
        <StatCard
          title="Not verified"
          icon={<BadgeCheck />}
          iconTone="warning"
          value={sum((t) => !t.verified)}
          format={fmtMoney}
          loading={q.isLoading}
        />
        <StatCard
          title="Form 16A pending"
          icon={<FileCheck2 />}
          iconTone="danger"
          value={sum((t) => t.certificateStatus === 'pending')}
          format={fmtMoney}
          loading={q.isLoading}
        />
      </div>
      <FilterBar>
        <ClientSelect all className="w-60" value={clientId} onChange={setClientId} />
        <Select
          className="w-40"
          size="sm"
          aria-label="Verified"
          value={verified}
          onValueChange={setVerified}
          options={[
            { value: ALL, label: 'Verified or not' },
            { value: 'false', label: 'To verify' },
            { value: 'true', label: 'Verified' },
          ]}
        />
        <Select
          className="w-44"
          size="sm"
          aria-label="Certificate"
          value={cert}
          onValueChange={setCert}
          options={[
            { value: ALL, label: 'Any certificate' },
            { value: 'pending', label: 'Form 16A pending' },
            { value: 'received', label: 'Form 16A received' },
          ]}
        />
      </FilterBar>
      <input
        ref={file}
        hidden
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <Card>
        <DataTable
          loading={q.isLoading}
          rows={q.data}
          rowKey={(t) => t.id}
          empty="No TDS entries match."
          columns={[
            {
              key: 'd',
              header: 'Deducted on',
              cell: (t) => <span className="text-xs">{fmtDate(t.deductionDate)}</span>,
            },
            {
              key: 'c',
              header: 'Client',
              cell: (t) => (
                <NameCell
                  name={t.clientName}
                  sub={
                    <Link className="text-brand-500" href={`/admin/invoices/${t.invoiceId}`}>
                      {t.invoiceNo}
                    </Link>
                  }
                />
              ),
            },
            { key: 's', header: 'Section', hideBelow: 'md', cell: (t) => t.section },
            { key: 'a', header: 'Amount', align: 'right', cell: (t) => <MoneyCell v={t.amount} strong /> },
            {
              key: 'st',
              header: 'Status',
              cell: (t) => (
                <div className="flex flex-wrap gap-1">
                  <Badge size="sm" tone={t.verified ? 'success' : 'warning'}>
                    {t.verified ? 'Verified' : 'To verify'}
                  </Badge>
                  <Badge size="sm" tone={t.certificateStatus === 'received' ? 'success' : 'neutral'}>
                    16A {t.certificateStatus}
                  </Badge>
                  {t.enteredByClient && (
                    <Badge size="sm" tone="brand">
                      By client
                    </Badge>
                  )}
                </div>
              ),
            },
            {
              key: 'x',
              header: '',
              align: 'right',
              cell: (t) => (
                <CardMenu
                  items={[
                    t.verified
                      ? {
                          label: 'Undo verification',
                          icon: <Undo2 className="size-4" />,
                          onSelect: () => void patch(t, { verified: false }, 'Marked unverified'),
                        }
                      : {
                          label: 'Verify (matches 26AS)',
                          icon: <BadgeCheck className="size-4" />,
                          onSelect: () => void patch(t, { verified: true }, 'TDS verified'),
                        },
                    {
                      label: 'Form 16A received',
                      icon: <FileCheck2 className="size-4" />,
                      disabled: t.certificateStatus === 'received',
                      onSelect: () => void patch(t, { certificateStatus: 'received' }, 'Certificate marked received'),
                    },
                    {
                      label: 'Upload certificate',
                      icon: <FileUp className="size-4" />,
                      onSelect: () => {
                        setTarget(t);
                        file.current?.click();
                      },
                    },
                    {
                      label: 'Download certificate',
                      icon: <Download className="size-4" />,
                      disabled: !t.certificateUploaded,
                      onSelect: () => void adminDownload(`/tds/${t.id}/certificate`),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}

function CreditNotes() {
  const [clientId, setClientId] = useState<string | undefined>();
  const [range, setRange] = useState<DateRange>({ from: fyStart(todayIST()), to: todayIST() });
  const q = useA<CreditNoteRow[]>('/credit-notes', { clientId, ...range });
  return (
    <>
      <FilterBar>
        <ClientSelect all className="w-60" value={clientId} onChange={setClientId} />
        <DateRangePicker value={range} onChange={setRange} max={todayIST()} />
      </FilterBar>
      <Card>
        <DataTable
          loading={q.isLoading}
          rows={q.data}
          rowKey={(c) => c.id}
          empty="No credit notes in this period."
          columns={[
            { key: 'n', header: 'Credit note', cell: (c) => <NameCell name={c.number} sub={fmtDate(c.date)} /> },
            {
              key: 'c',
              header: 'Client',
              cell: (c) => <NameCell name={c.clientName} sub={`against ${c.invoiceNo}`} />,
            },
            {
              key: 'r',
              header: 'Reason',
              hideBelow: 'lg',
              cell: (c) => <span className="text-ink-500 text-xs">{c.reason}</span>,
            },
            { key: 't', header: 'Taxable', align: 'right', hideBelow: 'md', cell: (c) => <MoneyCell v={c.taxable} /> },
            { key: 'g', header: 'Total', align: 'right', cell: (c) => <MoneyCell v={c.total} strong /> },
            {
              key: 'p',
              header: '',
              align: 'right',
              cell: (c) => (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="PDF"
                  disabled={!c.pdfReady}
                  onClick={() => void adminDownload(`/credit-notes/${c.id}/pdf`)}
                >
                  <Download />
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
