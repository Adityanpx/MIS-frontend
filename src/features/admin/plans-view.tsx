'use client';

import { Archive, Calculator, Layers, Pencil, Plus, RotateCcw, Users } from 'lucide-react';
import { useState } from 'react';
import { HoverLift, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardMenu } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/tabs';
import { fmtMoney, fmtMoney0, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { planCreateBody, planPatchBody, planPreviewBody } from '@/shared/schemas/admin';
import { adminApi, check, errorsOf, ReasonDialog, toastError, useA, useRun } from './kit';
import type { Plan, PriceTable } from './types';

/** /admin/plans — price plans with a live 5/10/15-year price table (PLN-01…05). */
export function PlansView() {
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const q = useA<Plan[]>('/plans', { status });
  const [edit, setEdit] = useState<Plan | 'new' | null>(null);
  const [archive, setArchive] = useState<Plan | null>(null);
  const { run } = useRun();
  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="Yearly price, escalation and upfront discount — used by every new subscription"
        actions={
          <>
            <Segmented
              value={status}
              onChange={setStatus}
              items={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
            <Button onClick={() => setEdit('new')}>
              <Plus /> New plan
            </Button>
          </>
        }
      />
      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="rounded-card h-64" />
          ))}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={<Layers />} title={status === 'active' ? 'No plans yet' : 'No archived plans'} />
        </Card>
      ) : (
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(q.data ?? []).map((p) => (
            <StaggerItem key={p.id}>
              <HoverLift>
                <Card className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-ink-400 text-xs font-semibold tracking-wider uppercase">{p.code}</p>
                      <p className="text-ink-900 text-lg font-semibold">{p.name}</p>
                    </div>
                    <CardMenu
                      items={[
                        { label: 'Edit', icon: <Pencil className="size-4" />, onSelect: () => setEdit(p) },
                        p.status === 'active'
                          ? {
                              label: 'Archive',
                              icon: <Archive className="size-4" />,
                              danger: true,
                              onSelect: () => setArchive(p),
                            }
                          : {
                              label: 'Restore',
                              icon: <RotateCcw className="size-4" />,
                              onSelect: () =>
                                void run(
                                  'restore',
                                  () => adminApi.post(`/plans/${p.id}/restore`),
                                  'Plan restored',
                                ).catch(toastError),
                            },
                      ]}
                    />
                  </div>
                  <p className="text-ink-900 tabular mt-4 text-3xl font-semibold tracking-tight">
                    {fmtMoney0(p.pricePerYear)}
                    <span className="text-ink-400 text-sm font-normal"> / plant / year</span>
                  </p>
                  {p.description && <p className="text-ink-500 mt-2 text-sm">{p.description}</p>}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{p.termYears} years</Badge>
                    {p.escalationPct > 0 && <Badge tone="warning">+{p.escalationPct}% / yr</Badge>}
                    {p.upfrontDiscountPct > 0 && <Badge tone="success">−{p.upfrontDiscountPct}% upfront</Badge>}
                  </div>
                  <div className="text-ink-500 border-line mt-auto flex items-center justify-between border-t pt-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" /> {fmtNum(p.maxUsersPerPlant)} users · {fmtNum(p.storageGb)} GB
                    </span>
                    <span>{fmtNum(p.subscriptionsCount)} subscription(s)</span>
                  </div>
                </Card>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      )}
      {edit && <PlanDrawer plan={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {archive && (
        <ReasonDialog
          open
          noReason
          title={`Archive ${archive.name}?`}
          description="Existing subscriptions keep their price; the plan can no longer be chosen."
          confirm="Archive"
          onClose={() => setArchive(null)}
          onConfirm={() => run('archive', () => adminApi.post(`/plans/${archive.id}/archive`), 'Plan archived')}
        />
      )}
    </>
  );
}

function PlanDrawer({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const terms = useA<{ allowedTerms: number[] }>('/settings/plans');
  const [f, setF] = useState({
    name: plan?.name ?? '',
    code: plan?.code ?? '',
    description: plan?.description ?? '',
    termYears: String(plan?.termYears ?? 5),
    pricePerYear: plan?.pricePerYear ?? '',
    escalationPct: String(plan?.escalationPct ?? 0),
    upfrontDiscountPct: String(plan?.upfrontDiscountPct ?? 0),
    maxUsersPerPlant: String(plan?.maxUsersPerPlant ?? 10),
    storageGb: String(plan?.storageGb ?? 5),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [table, setTable] = useState<PriceTable | null>(null);
  const { run, busy } = useRun();
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function preview() {
    const v = check(planPreviewBody, {
      termYears: f.termYears,
      pricePerYear: f.pricePerYear.trim(),
      escalationPct: f.escalationPct,
      upfrontDiscountPct: f.upfrontDiscountPct,
    });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    const t = await run('preview', () => adminApi.post<PriceTable>('/plans/preview', v.data)).catch(toastError);
    if (t) setTable(t);
  }
  async function save() {
    const common = {
      name: f.name.trim(),
      ...(f.description.trim() ? { description: f.description.trim() } : {}),
      termYears: f.termYears,
      pricePerYear: f.pricePerYear.trim(),
      escalationPct: f.escalationPct,
      upfrontDiscountPct: f.upfrontDiscountPct,
      maxUsersPerPlant: f.maxUsersPerPlant,
      storageGb: f.storageGb,
    };
    const v = plan
      ? check(planPatchBody, common)
      : check(planCreateBody, { ...common, code: f.code.trim().toUpperCase() });
    if (!v.ok) return setErrors(v.errors);
    try {
      await run(
        'save',
        () => (plan ? adminApi.patch(`/plans/${plan.id}`, v.data) : adminApi.post('/plans', v.data)),
        plan ? 'Plan saved' : 'Plan created',
      );
      onClose();
    } catch (e) {
      setErrors(errorsOf(e));
    }
  }
  const num = (k: keyof typeof f, label: string, hint?: string) => (
    <Field label={label} hint={hint} error={errors[k]}>
      <Input inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} invalid={!!errors[k]} />
    </Field>
  );
  return (
    <Drawer
      open
      width="lg"
      onOpenChange={(o) => !o && onClose()}
      title={plan ? `Edit ${plan.name}` : 'New plan'}
      description={plan ? 'Changes apply to new subscriptions only.' : undefined}
      footer={
        <div className="flex w-full gap-2">
          <Button variant="secondary" onClick={preview} loading={busy === 'preview'}>
            <Calculator /> Price table
          </Button>
          <Button className="flex-1" onClick={save} loading={busy === 'save'}>
            {plan ? 'Save' : 'Create plan'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={errors.name}>
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Code" required={!plan} error={errors.code}>
          <Input className="uppercase" value={f.code} disabled={!!plan} onChange={(e) => set('code', e.target.value)} />
        </Field>
        <Field label="Term" required>
          <Select
            value={f.termYears}
            onValueChange={(v) => set('termYears', v)}
            options={(terms.data?.allowedTerms ?? [5, 10, 15]).map((t) => ({ value: String(t), label: `${t} years` }))}
          />
        </Field>
        {num('pricePerYear', 'Price per plant per year (₹)')}
        {num('escalationPct', 'Yearly escalation %', '0–25')}
        {num('upfrontDiscountPct', 'Upfront discount %', '0–50')}
        {num('maxUsersPerPlant', 'Users per plant')}
        {num('storageGb', 'Storage per plant (GB)')}
        <Field label="Description" className="sm:col-span-2">
          <Textarea rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
      </div>
      {table && <PriceTableView t={table} />}
    </Drawer>
  );
}

function PriceTableView({ t }: { t: PriceTable }) {
  return (
    <div className="rounded-inner border-line mt-6 border p-4">
      <p className="text-ink-900 mb-3 text-sm font-semibold">Price table (ex GST)</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {t.years.map((y) => (
          <div key={y.yearNo} className="bg-canvas rounded-xl p-2 text-center">
            <p className="text-ink-400 text-[11px]">Year {y.yearNo}</p>
            <p className="tabular text-ink-900 text-xs font-semibold">{fmtMoney0(y.amount)}</p>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        {[
          ['Yearly total (ex GST)', t.totalExGst],
          [`GST ${t.gstRatePct}%`, t.gst],
          ['Yearly total (inc GST)', t.totalIncGst],
          [`Upfront (−${t.upfront.discountPct}%) ex GST`, t.upfront.amountExGst],
          ['Upfront inc GST', t.upfront.totalIncGst],
          ['Saving with upfront', t.upfront.savingExGst],
        ].map(([k, v], i) => (
          <div key={k} className={cn('flex justify-between gap-2 py-1', i === 2 && 'font-semibold')}>
            <dt className="text-ink-500">{k}</dt>
            <dd className="tabular text-ink-900">{fmtMoney(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
