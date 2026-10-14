'use client';

import { ChevronDown, Copy, IndianRupee, Percent, PencilLine, Plus, Trash2, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { BarChart } from '@/components/charts/bar-chart';
import { Collapse } from '@/components/motion/primitives';
import { Badge } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState, Switch } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/tabs';
import { clientApi } from '@/lib/api';
import { todayIST } from '@/lib/dates';
import { fmtCompact, fmtDate, fmtMoney, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  applyEscalationBody,
  componentCreateBody,
  componentPatchBody,
  contractYearPatchBody,
} from '@/shared/schemas/settings';
import { usePlant } from '../plant-context';
import { Fact, numOrUndef, SectionHeader, SectionSkeleton, ToggleRow, useCanEditSettings } from './parts';
import { apiErrors, checkBody, useSettings, useSettingsWrite } from './queries';
import type { ContractYear, ContractYears, RevenueComponent } from './types';

type Req = { path: string; method: 'post' | 'patch' | 'del'; body?: unknown };

/** §11.6 Contract years, fixed fee, variable revenue components and escalation (REV-01…REV-06). */
export function ContractSection() {
  const { can } = usePlant();
  const q = useSettings('contract-years', can('revenue.view'));
  const params = useSettings('parameters');
  const canEdit = useCanEditSettings();
  const today = todayIST();
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [fee, setFee] = useState<{ year: ContractYear; value: string } | null>(null);
  const [comp, setComp] = useState<{
    year: ContractYear;
    c: RevenueComponent | null;
    v: { name: string; parameterCode: string; rate: string; stdQtyPerDay: string };
  } | null>(null);
  const [esc, setEsc] = useState<{
    fromYearNo: string;
    pct: string;
    target: 'fixed_fee' | 'component_rates' | 'both';
    round: boolean;
  } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const write = useSettingsWrite({
    key: 'contract-years',
    request: (id, r: Req) => {
      const url = `/plants/${id}/settings/contract-years${r.path}`;
      return (
        r.method === 'del' ? clientApi.del<ContractYears>(url) : clientApi[r.method]<ContractYears>(url, r.body)
      ) as never;
    },
    success: 'Contract figures saved — revenue is recalculated',
  });
  const sumParams = useMemo(
    () =>
      (params.data ?? [])
        .filter((p) => p.aggregation === 'sum' && !p.activeTo)
        .map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
    [params.data],
  );

  if (!can('revenue.view')) {
    return (
      <Card>
        <EmptyState
          icon={<IndianRupee />}
          title="Client Admins only"
          description="Contract values and revenue are visible to Client Admins."
        />
      </Card>
    );
  }
  if (!q.data) return <SectionSkeleton rows={3} />;
  const data = q.data;
  const current = data.years.find((y) => y.startDate <= today && y.endDate >= today)?.yearNo ?? null;
  const active = openYear ?? current ?? data.years[0]?.yearNo ?? null;
  const cur = data.years.find((y) => y.yearNo === current);

  async function run(r: Req, done: () => void) {
    try {
      await write.mutateAsync(r);
      done();
    } catch (e) {
      setErrors(apiErrors(e));
    }
  }
  function saveFee() {
    if (!fee) return;
    const c = checkBody(contractYearPatchBody, { fixedFee: fee.value.replace(/[,\s₹]/g, '') });
    if (!c.ok) return setErrors(c.errors);
    void run({ path: `/${fee.year.yearNo}`, method: 'patch', body: c.data }, () => setFee(null));
  }
  function saveComp() {
    if (!comp) return;
    const body = { name: comp.v.name, rate: numOrUndef(comp.v.rate), stdQtyPerDay: numOrUndef(comp.v.stdQtyPerDay) };
    if (comp.c) {
      const c = checkBody(componentPatchBody, body);
      if (!c.ok) return setErrors(c.errors);
      void run({ path: `/${comp.year.yearNo}/components/${comp.c.id}`, method: 'patch', body: c.data }, () =>
        setComp(null),
      );
    } else {
      const c = checkBody(componentCreateBody, { ...body, parameterCode: comp.v.parameterCode });
      if (!c.ok) return setErrors(c.errors);
      void run({ path: `/${comp.year.yearNo}/components`, method: 'post', body: c.data }, () => setComp(null));
    }
  }
  function saveEsc() {
    if (!esc) return;
    const c = checkBody(applyEscalationBody, {
      fromYearNo: numOrUndef(esc.fromYearNo),
      pct: numOrUndef(esc.pct),
      target: esc.target,
      roundUpToRupee: esc.round,
    });
    if (!c.ok) return setErrors(c.errors);
    void run({ path: '/apply-escalation', method: 'post', body: c.data }, () => setEsc(null));
  }

  // escalation preview (same arithmetic as the API: previous year × (1 + pct), optional ceil)
  const preview = (() => {
    if (!esc) return [];
    const from = Number(esc.fromYearNo);
    const pct = Number(esc.pct);
    if (!Number.isFinite(from) || !Number.isFinite(pct) || esc.target === 'component_rates') return [];
    let prev = Number(data.years.find((y) => y.yearNo === from - 1)?.fixedFee ?? 0);
    return data.years
      .filter((y) => y.yearNo >= from)
      .map((y) => {
        let f = prev * (1 + pct / 100);
        f = esc.round ? Math.ceil(f) : Math.round(f * 100) / 100;
        prev = f;
        return { yearNo: y.yearNo, before: Number(y.fixedFee), after: f };
      });
  })();

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Contract & revenue"
        description="One row per contract year: the fixed O&M fee and the variable components paid per unit (e.g. BGE power). The dashboard's revenue figures come from here."
        actions={
          <Button
            variant="secondary"
            onClick={() => (setErrors({}), setEsc({ fromYearNo: '2', pct: '5', target: 'fixed_fee', round: false }))}
          >
            <Percent /> Apply escalation
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="bg-premium relative overflow-hidden text-white">
          <div className="dot-grid absolute inset-0 opacity-20" />
          <div className="relative">
            <p className="text-sm font-medium text-white/70">Total contract value</p>
            <p className="mt-2 text-[34px] leading-none font-semibold tracking-tight">
              {fmtCompact(Number(data.totalContractValue), { money: true, decimals: 2 })}
            </p>
            <p className="mt-2 text-xs text-white/60">{fmtMoney(data.totalContractValue)}</p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] tracking-wider text-white/60 uppercase">Years</p>
                <p className="text-lg font-semibold">{data.years.length}</p>
              </div>
              <div>
                <p className="text-[11px] tracking-wider text-white/60 uppercase">Current year</p>
                <p className="text-lg font-semibold">{current ? `Year ${current}` : '—'}</p>
              </div>
              {cur && (
                <>
                  <div>
                    <p className="text-[11px] tracking-wider text-white/60 uppercase">Fixed fee / month</p>
                    <p className="text-lg font-semibold">
                      {fmtCompact(Number(cur.derived.fixedPerMonth), { money: true, decimals: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-wider text-white/60 uppercase">Variable std / month</p>
                    <p className="text-lg font-semibold">
                      {fmtCompact(Number(cur.derived.variableStdPerMonth), { money: true, decimals: 2 })}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
        <Card>
          <p className="text-ink-900 mb-1 text-base font-semibold">Contract value by year</p>
          <p className="text-ink-500 mb-3 text-xs">Fixed fee + variable components at standard quantities</p>
          <BarChart
            height={190}
            highlight={current ? data.years.findIndex((y) => y.yearNo === current) : 'last'}
            seriesLabel="Contract value"
            format={(v) => fmtCompact(v, { money: true })}
            showYAxis={false}
            data={data.years.map((y) => ({ label: `Y${y.yearNo}`, value: Number(y.derived.contractValue) }))}
          />
        </Card>
      </div>

      <div className="space-y-3">
        {data.years.map((y) => {
          const open = active === y.yearNo;
          const state = y.endDate < today ? 'past' : y.startDate > today ? 'upcoming' : 'current';
          return (
            <Card key={y.yearNo} padded={false}>
              <button
                type="button"
                onClick={() => setOpenYear(open ? -1 : y.yearNo)}
                className="flex w-full flex-wrap items-center gap-4 p-5 text-left"
              >
                <span
                  className={cn(
                    'grid size-11 place-items-center rounded-2xl text-sm font-bold',
                    state === 'current' ? 'bg-primary-btn text-white' : 'bg-muted-bg text-ink-700',
                  )}
                >
                  Y{y.yearNo}
                </span>
                <div className="min-w-[180px] flex-1">
                  <p className="text-ink-900 flex items-center gap-2 text-sm font-semibold">
                    {fmtDate(y.startDate)} – {fmtDate(y.endDate)}
                    {state === 'current' && (
                      <Badge tone="brand" size="sm">
                        Current
                      </Badge>
                    )}
                    {!y.feeConfigured && (
                      <Badge tone="warning" size="sm">
                        Fee not set
                      </Badge>
                    )}
                  </p>
                  <p className="text-ink-500 text-xs">
                    {y.days} days · {y.components.length} variable component(s)
                  </p>
                </div>
                <Fact label="Fixed fee" className="w-36">
                  {fmtMoney(y.fixedFee)}
                </Fact>
                <Fact label="Contract value" className="hidden w-36 sm:block">
                  {fmtMoney(y.derived.contractValue)}
                </Fact>
                <ChevronDown className={cn('text-ink-400 size-5 transition-transform', open && 'rotate-180')} />
              </button>
              <Collapse open={open}>
                <div className="border-line border-t p-5">
                  <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
                    <Fact label="Fixed / day">{fmtMoney(y.derived.fixedPerDay)}</Fact>
                    <Fact label="Fixed / month">{fmtMoney(y.derived.fixedPerMonth)}</Fact>
                    <Fact label="Variable std / day">{fmtMoney(y.derived.variableStdPerDay)}</Fact>
                    <Fact label="Variable std / month">{fmtMoney(y.derived.variableStdPerMonth)}</Fact>
                    <Fact label="Variable std / year">{fmtMoney(y.derived.variableStdPerYear)}</Fact>
                    <Fact label="Contract value">{fmtMoney(y.derived.contractValue)}</Fact>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-ink-900 text-sm font-semibold">Variable components</p>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        {y.yearNo > 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={write.isPending}
                            onClick={() =>
                              void run({ path: `/${y.yearNo}/copy-previous`, method: 'post' }, () => undefined)
                            }
                          >
                            <Copy /> Copy year {y.yearNo - 1}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => (setErrors({}), setFee({ year: y, value: y.fixedFee }))}
                        >
                          <IndianRupee /> Fixed fee
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => (
                            setErrors({}),
                            setComp({
                              year: y,
                              c: null,
                              v: { name: '', parameterCode: sumParams[0]?.value ?? '', rate: '', stdQtyPerDay: '0' },
                            })
                          )}
                        >
                          <Plus /> Component
                        </Button>
                      </div>
                    )}
                  </div>
                  {y.components.length === 0 ? (
                    <p className="text-ink-500 mt-3 text-sm">Only the fixed fee is paid this year.</p>
                  ) : (
                    <div className="rounded-inner border-line mt-3 overflow-x-auto border">
                      <table className="w-full min-w-[560px] text-[13px]">
                        <thead className="bg-canvas text-ink-400 text-left text-[11px] tracking-wider uppercase">
                          <tr>
                            <th className="px-4 py-2 font-medium">Component</th>
                            <th className="px-4 py-2 font-medium">Paid on</th>
                            <th className="px-4 py-2 text-right font-medium">Rate</th>
                            <th className="px-4 py-2 text-right font-medium">Std qty / day</th>
                            <th className="px-4 py-2 text-right font-medium">Std / day</th>
                            {canEdit && <th className="w-20" />}
                          </tr>
                        </thead>
                        <tbody className="divide-line divide-y">
                          {y.components.map((c) => (
                            <tr key={c.id}>
                              <td className="text-ink-900 px-4 py-2.5 font-semibold">{c.name}</td>
                              <td className="text-ink-500 px-4 py-2.5 font-mono text-[11px]">{c.parameterCode}</td>
                              <td className="tabular px-4 py-2.5 text-right">₹{fmtNum(c.rate, 4)}</td>
                              <td className="tabular px-4 py-2.5 text-right">{fmtNum(c.stdQtyPerDay)}</td>
                              <td className="tabular text-ink-900 px-4 py-2.5 text-right font-semibold">
                                {fmtMoney(c.rate * c.stdQtyPerDay)}
                              </td>
                              {canEdit && (
                                <td className="px-2 text-right whitespace-nowrap">
                                  <IconButton
                                    size="sm"
                                    aria-label="Edit component"
                                    onClick={() => (
                                      setErrors({}),
                                      setComp({
                                        year: y,
                                        c,
                                        v: {
                                          name: c.name,
                                          parameterCode: c.parameterCode,
                                          rate: String(c.rate),
                                          stdQtyPerDay: String(c.stdQtyPerDay),
                                        },
                                      })
                                    )}
                                  >
                                    <PencilLine />
                                  </IconButton>
                                  <IconButton
                                    size="sm"
                                    aria-label="Delete component"
                                    onClick={() =>
                                      void run(
                                        { path: `/${y.yearNo}/components/${c.id}`, method: 'del' },
                                        () => undefined,
                                      )
                                    }
                                  >
                                    <Trash2 />
                                  </IconButton>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Collapse>
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!fee}
        onOpenChange={(o) => !o && !write.isPending && setFee(null)}
        icon={<IndianRupee />}
        title={`Fixed fee · year ${fee?.year.yearNo ?? ''}`}
        description="The O&M fee for the whole contract year (excluding GST). Revenue per day = fee ÷ days."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFee(null)}>
              Cancel
            </Button>
            <Button onClick={saveFee} loading={write.isPending}>
              Save fee
            </Button>
          </>
        }
      >
        {fee && (
          <Field label="Fixed fee (₹)" required error={errors.fixedFee}>
            <Input
              inputMode="decimal"
              leading={<IndianRupee />}
              value={fee.value}
              onChange={(e) => setFee({ ...fee, value: e.target.value })}
            />
          </Field>
        )}
      </Modal>

      <Modal
        open={!!comp}
        onOpenChange={(o) => !o && !write.isPending && setComp(null)}
        icon={<TrendingUp />}
        title={comp?.c ? `Edit ${comp.c.name}` : `Add a component · year ${comp?.year.yearNo ?? ''}`}
        description="Paid per unit of a SUM parameter (e.g. ₹ per kWh of BGE power). The standard quantity gives the expected revenue."
        footer={
          <>
            <Button variant="ghost" onClick={() => setComp(null)}>
              Cancel
            </Button>
            <Button onClick={saveComp} loading={write.isPending}>
              Save
            </Button>
          </>
        }
      >
        {comp && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2" label="Name" required error={errors.name}>
              <Input
                value={comp.v.name}
                onChange={(e) => setComp({ ...comp, v: { ...comp.v, name: e.target.value } })}
              />
            </Field>
            {!comp.c && (
              <Field className="sm:col-span-2" label="Paid on parameter" required error={errors.parameterCode}>
                <Select
                  value={comp.v.parameterCode}
                  options={sumParams}
                  onValueChange={(v) => setComp({ ...comp, v: { ...comp.v, parameterCode: v } })}
                />
              </Field>
            )}
            <Field label="Rate (₹ per unit)" required error={errors.rate}>
              <Input
                inputMode="decimal"
                value={comp.v.rate}
                onChange={(e) => setComp({ ...comp, v: { ...comp.v, rate: e.target.value } })}
              />
            </Field>
            <Field label="Standard quantity / day" error={errors.stdQtyPerDay}>
              <Input
                inputMode="decimal"
                value={comp.v.stdQtyPerDay}
                onChange={(e) => setComp({ ...comp, v: { ...comp.v, stdQtyPerDay: e.target.value } })}
              />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!esc}
        onOpenChange={(o) => !o && !write.isPending && setEsc(null)}
        icon={<Percent />}
        size="lg"
        title="Apply escalation"
        description="Each year from the chosen one = the previous year × (1 + %). Existing values of those years are replaced."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEsc(null)}>
              Cancel
            </Button>
            <Button onClick={saveEsc} loading={write.isPending}>
              Apply to {preview.length || 'the'} year(s)
            </Button>
          </>
        }
      >
        {esc && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From year" error={errors.fromYearNo}>
                <Select
                  value={esc.fromYearNo}
                  onValueChange={(v) => setEsc({ ...esc, fromYearNo: v })}
                  options={data.years
                    .filter((y) => y.yearNo >= 2)
                    .map((y) => ({ value: String(y.yearNo), label: `Year ${y.yearNo} (${fmtDate(y.startDate)})` }))}
                />
              </Field>
              <Field label="Escalation %" error={errors.pct}>
                <Input
                  inputMode="decimal"
                  value={esc.pct}
                  onChange={(e) => setEsc({ ...esc, pct: e.target.value })}
                  trailing={<Percent />}
                />
              </Field>
            </div>
            <Segmented
              value={esc.target}
              onChange={(v) => setEsc({ ...esc, target: v })}
              items={[
                { value: 'fixed_fee', label: 'Fixed fee' },
                { value: 'component_rates', label: 'Component rates' },
                { value: 'both', label: 'Both' },
              ]}
            />
            <ToggleRow
              title="Round up to whole rupees"
              control={<Switch checked={esc.round} onCheckedChange={(v) => setEsc({ ...esc, round: v })} />}
            />
            {preview.length > 0 && (
              <div className="rounded-inner border-line overflow-hidden border">
                <table className="w-full text-[13px]">
                  <thead className="bg-canvas text-ink-400 text-left text-[11px] tracking-wider uppercase">
                    <tr>
                      <th className="px-4 py-2 font-medium">Year</th>
                      <th className="px-4 py-2 text-right font-medium">Now</th>
                      <th className="px-4 py-2 text-right font-medium">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-line divide-y">
                    {preview.map((p) => (
                      <motion.tr key={p.yearNo} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td className="px-4 py-2 font-semibold">Year {p.yearNo}</td>
                        <td className="text-ink-400 tabular px-4 py-2 text-right">{fmtMoney(p.before)}</td>
                        <td className="text-brand-600 tabular px-4 py-2 text-right font-semibold">
                          {fmtMoney(p.after)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
