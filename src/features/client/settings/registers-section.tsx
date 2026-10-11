'use client';

import { FileCheck2, FileUp, Landmark, PencilLine, Plus, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { DateField } from '@/components/date/date-field';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/popover';
import { DataTable, type Column } from '@/components/ui/table';
import { clientApi } from '@/lib/api';
import { diffDays, todayIST } from '@/lib/dates';
import { fmtDate, fmtMoney0 } from '@/lib/format';
import { cn } from '@/lib/utils';
import { bgCreateBody, bgPatchBody, insuranceCreateBody, insurancePatchBody } from '@/shared/schemas/settings';
import { SectionHeader, SectionSkeleton, str, useCanEditSettings } from './parts';
import { apiErrors, checkBody, useSettings, useSettingsWrite } from './queries';
import type { BankGuarantee, InsurancePolicy } from './types';

type Kind = 'bank-guarantees' | 'insurance';
type Entry = BankGuarantee | InsurancePolicy;
const MAX_DOC = 10 * 1024 * 1024;

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'money' | 'date' | 'int' | 'area';
  required?: boolean;
}
const DEF: Record<
  Kind,
  { title: string; one: string; description: string; fields: FieldDef[]; icon: typeof Landmark }
> = {
  'bank-guarantees': {
    title: 'Bank guarantees',
    one: 'bank guarantee',
    description:
      'Performance guarantees given to the end customer. They show on the MIS report and the dashboard with their validity.',
    icon: Landmark,
    fields: [
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'bgNumber', label: 'BG number', type: 'text', required: true },
      { key: 'bank', label: 'Bank', type: 'text', required: true },
      { key: 'amount', label: 'Amount (₹)', type: 'money', required: true },
      { key: 'startDate', label: 'Valid from', type: 'date', required: true },
      { key: 'endDate', label: 'Valid until', type: 'date', required: true },
      { key: 'claimMonths', label: 'Claim period (months)', type: 'int' },
      { key: 'remarks', label: 'Remarks', type: 'area' },
    ],
  },
  insurance: {
    title: 'Insurance policies',
    one: 'policy',
    description: 'Workmen compensation, fire and other policies the contract requires, with their validity.',
    icon: ShieldCheck,
    fields: [
      { key: 'policyType', label: 'Policy type', type: 'text', required: true },
      { key: 'policyNumber', label: 'Policy number', type: 'text', required: true },
      { key: 'insurer', label: 'Insurer', type: 'text', required: true },
      { key: 'sumAssured', label: 'Sum assured (₹)', type: 'money' },
      { key: 'startDate', label: 'Valid from', type: 'date', required: true },
      { key: 'endDate', label: 'Valid until', type: 'date', required: true },
      { key: 'premium', label: 'Premium (₹)', type: 'money' },
      { key: 'remarks', label: 'Remarks', type: 'area' },
    ],
  },
};

/** Validity chip + the elapsed share of the period as a thin bar. */
function Validity({ start, end }: { start: string; end: string }) {
  const today = todayIST();
  const left = diffDays(end, today);
  const total = Math.max(1, diffDays(end, start));
  const pct = Math.min(100, Math.max(0, (diffDays(today, start) / total) * 100));
  const tone = left < 0 ? 'danger' : left <= 60 ? 'warning' : 'success';
  return (
    <div className="w-36">
      <Badge tone={tone} size="sm" dot>
        {left < 0 ? `Expired ${fmtDate(end)}` : left <= 60 ? `${left} days left` : 'Valid'}
      </Badge>
      <div className="bg-muted-bg mt-1.5 h-1 overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full',
            tone === 'danger' ? 'bg-danger-500' : tone === 'warning' ? 'bg-warning-500' : 'bg-success-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** §11.10 Bank guarantees and §11.11 insurance — one register component, two definitions. */
export function RegistersSection({ kind }: { kind: Kind }) {
  const q = useSettings(kind);
  const canEdit = useCanEditSettings();
  const d = DEF[kind];
  const Icon = d.icon;
  const [edit, setEdit] = useState<{ entry: Entry | null; v: Record<string, string | null> } | null>(null);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);
  const write = useSettingsWrite({
    key: kind,
    request: (id, r: { path: string; method: 'post' | 'patch'; body: unknown }) =>
      clientApi[r.method]<Entry[]>(`/plants/${id}/settings/${kind}${r.path}`, r.body) as never,
    success: 'Saved',
  });
  const upload = useSettingsWrite({
    key: kind,
    request: (id, r: { entryId: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', r.file);
      return clientApi.upload<Entry[]>(`/plants/${id}/settings/${kind}/${r.entryId}/document`, fd) as never;
    },
    success: 'Document attached',
  });

  if (!q.data) return <SectionSkeleton rows={1} />;
  const rows = q.data as Entry[];

  const startEdit = (entry: Entry | null) => {
    setErrors({});
    const v: Record<string, string | null> = {};
    for (const f of d.fields) {
      const raw = entry ? (entry as unknown as Record<string, unknown>)[f.key] : f.key === 'claimMonths' ? '12' : '';
      v[f.key] = f.type === 'date' ? (raw as string | null) || null : str(raw as string | number | null);
    }
    setEdit({ entry, v });
    setOpen(true);
  };

  async function save() {
    if (!edit) return;
    const body: Record<string, unknown> = {};
    for (const f of d.fields) {
      const val = edit.v[f.key];
      const before = edit.entry ? (edit.entry as unknown as Record<string, unknown>)[f.key] : undefined;
      let out: unknown = val === '' || val === null ? undefined : val;
      if (f.type === 'money' && typeof out === 'string') out = out.replace(/[,\s₹]/g, '');
      if (f.type === 'int' && out !== undefined) out = Number(out);
      if (edit.entry) {
        if (String(out ?? '') === String(before ?? '')) continue;
        if (out === undefined && (f.type === 'money' || f.type === 'area')) out = null; // clearing an optional value
      }
      if (out !== undefined) body[f.key] = out;
    }
    const schema =
      kind === 'bank-guarantees'
        ? edit.entry
          ? bgPatchBody
          : bgCreateBody
        : edit.entry
          ? insurancePatchBody
          : insuranceCreateBody;
    const c = checkBody(schema as never, body);
    if (!c.ok) return setErrors(c.errors);
    try {
      await write.mutateAsync({
        path: edit.entry ? `/${edit.entry.id}` : '',
        method: edit.entry ? 'patch' : 'post',
        body: c.data,
      });
      setOpen(false);
    } catch (e) {
      setErrors(apiErrors(e));
    }
  }

  function pickFile(entryId: string) {
    setUploadFor(entryId);
    fileRef.current?.click();
  }
  async function onFile(f: File | undefined) {
    if (!f || !uploadFor) return;
    if (f.size > MAX_DOC) return void toast.error('The file is larger than 10 MB.');
    if (!/\.(pdf|png|jpe?g)$/i.test(f.name)) return void toast.error('Upload a PDF, PNG or JPG file.');
    try {
      await upload.mutateAsync({ entryId: uploadFor, file: f });
    } catch (e) {
      apiErrors(e);
    } finally {
      setUploadFor(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const isBg = kind === 'bank-guarantees';
  const columns: Column<Entry>[] = [
    {
      key: 'name',
      header: isBg ? 'Guarantee' : 'Policy',
      cell: (e) => {
        const r = e as unknown as Record<string, string>;
        return (
          <div className="min-w-0">
            <p className="text-ink-900 font-semibold">{isBg ? r.label : r.policyType}</p>
            <p className="text-ink-400 truncate text-[11px]">
              {isBg ? r.bgNumber : r.policyNumber} · {isBg ? r.bank : r.insurer}
            </p>
          </div>
        );
      },
    },
    {
      key: 'period',
      header: 'Period',
      hideBelow: 'md',
      cell: (e) => (
        <span className="tabular text-ink-700 text-[13px]">
          {fmtDate(e.startDate)} – {fmtDate(e.endDate)}
        </span>
      ),
    },
    {
      key: 'amount',
      header: isBg ? 'Amount' : 'Sum assured',
      align: 'right',
      hideBelow: 'sm',
      cell: (e) => (
        <span className="tabular text-ink-900 font-semibold">
          {isBg ? fmtMoney0((e as BankGuarantee).amount) : fmtMoney0((e as InsurancePolicy).sumAssured)}
        </span>
      ),
    },
    { key: 'validity', header: 'Validity', cell: (e) => <Validity start={e.startDate} end={e.endDate} /> },
    {
      key: 'doc',
      header: '',
      align: 'right',
      width: '110px',
      cell: (e) => (
        <span className="inline-flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
          {e.documentUrl ? (
            <Tooltip content="Open the document">
              <a
                href={e.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-success-600 hover:bg-success-50 grid size-8 place-items-center rounded-full"
              >
                <FileCheck2 className="size-4" />
              </a>
            </Tooltip>
          ) : null}
          {canEdit && (
            <>
              <Tooltip content={e.documentUrl ? 'Replace the document' : 'Attach the document (PDF/PNG/JPG)'}>
                <IconButton
                  size="sm"
                  aria-label="Attach document"
                  onClick={() => pickFile(e.id)}
                  disabled={upload.isPending}
                >
                  <FileUp />
                </IconButton>
              </Tooltip>
              <IconButton size="sm" aria-label="Edit" onClick={() => startEdit(e)}>
                <PencilLine />
              </IconButton>
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={d.title}
        description={d.description}
        actions={
          <Button onClick={() => startEdit(null)}>
            <Plus /> Add {d.one}
          </Button>
        }
      />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Icon />} title={`No ${d.title.toLowerCase()} yet`} description={d.description} />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(e) => e.id} onRowClick={canEdit ? startEdit : undefined} />
        )}
      </Card>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Drawer
        open={open}
        onOpenChange={(o) => !write.isPending && setOpen(o)}
        title={edit?.entry ? `Edit ${d.one}` : `Add a ${d.one}`}
        description="Dates are inclusive. The end date must be on or after the start date."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={write.isPending}>
              Save
            </Button>
          </div>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            {d.fields.map((f) => (
              <Field
                key={f.key}
                label={f.label}
                required={f.required}
                error={errors[f.key]}
                className={f.type === 'area' ? 'sm:col-span-2' : undefined}
              >
                {f.type === 'date' ? (
                  <DateField
                    value={edit.v[f.key]}
                    onChange={(x) => setEdit({ ...edit, v: { ...edit.v, [f.key]: x } })}
                  />
                ) : f.type === 'area' ? (
                  <Textarea
                    rows={3}
                    value={edit.v[f.key] ?? ''}
                    onChange={(e) => setEdit({ ...edit, v: { ...edit.v, [f.key]: e.target.value } })}
                  />
                ) : (
                  <Input
                    inputMode={f.type === 'money' ? 'decimal' : f.type === 'int' ? 'numeric' : undefined}
                    value={edit.v[f.key] ?? ''}
                    invalid={!!errors[f.key]}
                    onChange={(e) => setEdit({ ...edit, v: { ...edit.v, [f.key]: e.target.value } })}
                  />
                )}
              </Field>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  );
}
