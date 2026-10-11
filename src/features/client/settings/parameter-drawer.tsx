'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Ban, Calculator, CircleCheck, CircleX, Link2, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { Select } from '@/components/ui/select';
import { Segmented, Tabs } from '@/components/ui/tabs';
import { clientApi } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { formulaRefs, orderCalculated, parseFormula } from '@/shared/formula';
import { parameterCreateBody, parameterPatchBody, standardCreateBody } from '@/shared/schemas/settings';
import { usePlant } from '../plant-context';
import {
  EFFECTIVE_TODAY,
  EffectiveFields,
  effectiveBody,
  effectiveErrors,
  HistoryList,
  numOrNull,
  numOrUndef,
  str,
  standardText,
  ToggleRow,
  useCanEditSettings,
  type EffectiveValue,
} from './parts';
import { apiErrors, checkBody, useSettings } from './queries';
import { BLOCK_LABEL, GROUP_LABEL, LINK_ROLE_LABEL, type ParameterDto } from './types';

const opt = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));
const AGG = {
  sum: 'Sum (totals add up)',
  avg: 'Average',
  snapshot: 'Snapshot (last value)',
  stock: 'Stock balance',
  text: 'Text',
};
const STD = {
  per_day: 'Per day',
  monthly_allowance: 'Monthly allowance',
  range: 'Range (min – max)',
  required_qty: 'Required quantity',
  none: 'No standard',
};
const DIR = {
  higher_better: 'Higher is better',
  lower_better: 'Lower is better',
  within_range: 'Within range',
  neutral: 'Neutral',
};
const EVT = { above_std: 'Above standard', below_std: 'Below standard', outside_range: 'Outside range', none: 'Never' };
const MIS = {
  none: 'Not on the MIS',
  key: 'Key parameters',
  chemicals: 'Chemicals',
  lab_inlet: 'Inlet lab',
  lab_outlet: 'Outlet lab',
};
const CHART = { none: 'No chart', bar: 'Bars', line: 'Line', cone: 'Cones' };
const METRIC = { none: '—', avg_per_day: 'Average per day', monthly_total: 'Monthly total' };

type Form = {
  code: string;
  name: string;
  shortName: string;
  groupKey: string;
  unit: string;
  inputMode: 'typed' | 'calculated' | 'suggested';
  formula: string;
  decimals: string;
  hardMin: string;
  hardMax: string;
  aggregation: string;
  stdType: string;
  direction: string;
  eventRule: string;
  resultNoun: string;
  logsheetBlock: string;
  logsheetOrder: string;
  misSection: string;
  misOrder: string;
  dashboardCard: boolean;
  dashboardOrder: string;
  chartType: string;
  chartMetric: string;
  mandatory: boolean;
  std: string;
  monthly: string;
  min: string;
  max: string;
};
const EMPTY: Form = {
  code: '',
  name: '',
  shortName: '',
  groupKey: 'key',
  unit: '',
  inputMode: 'typed',
  formula: '',
  decimals: '2',
  hardMin: '0',
  hardMax: '',
  aggregation: 'sum',
  stdType: 'per_day',
  direction: 'higher_better',
  eventRule: 'above_std',
  resultNoun: '',
  logsheetBlock: '1',
  logsheetOrder: '',
  misSection: 'none',
  misOrder: '',
  dashboardCard: false,
  dashboardOrder: '',
  chartType: 'none',
  chartMetric: 'none',
  mandatory: true,
  std: '',
  monthly: '',
  min: '',
  max: '',
};
const fromDto = (p: ParameterDto): Form => ({
  ...EMPTY,
  code: p.code,
  name: p.name,
  shortName: str(p.shortName),
  groupKey: p.groupKey,
  unit: p.unit,
  inputMode: p.inputMode,
  formula: str(p.formula),
  decimals: str(p.decimals),
  hardMin: str(p.hardMin),
  hardMax: str(p.hardMax),
  aggregation: p.aggregation,
  stdType: p.stdType,
  direction: p.direction,
  eventRule: p.eventRule,
  resultNoun: str(p.resultNoun),
  logsheetBlock: str(p.logsheetBlock ?? 8),
  logsheetOrder: str(p.logsheetOrder),
  misSection: p.misSection ?? 'none',
  misOrder: str(p.misOrder),
  dashboardCard: p.dashboardCard,
  dashboardOrder: str(p.dashboardOrder),
  chartType: p.chartType,
  chartMetric: p.chartMetric ?? 'none',
  mandatory: p.mandatory,
});

/** Shared shape of the create and patch bodies (zod coerces/validates on top). */
function toBody(f: Form) {
  return {
    name: f.name,
    shortName: f.shortName.trim() || undefined,
    groupKey: f.groupKey,
    unit: f.unit,
    inputMode: f.inputMode,
    formula: f.inputMode === 'typed' ? undefined : f.formula.trim() || undefined,
    decimals: numOrUndef(f.decimals),
    hardMin: numOrNull(f.hardMin),
    hardMax: numOrNull(f.hardMax),
    aggregation: f.aggregation,
    stdType: f.stdType,
    direction: f.direction,
    eventRule: f.eventRule,
    resultNoun: f.resultNoun.trim() || undefined,
    logsheetBlock: numOrUndef(f.logsheetBlock),
    logsheetOrder: numOrUndef(f.logsheetOrder),
    misSection: f.misSection === 'none' ? null : f.misSection,
    misOrder: numOrUndef(f.misOrder),
    dashboardCard: f.dashboardCard,
    dashboardOrder: numOrUndef(f.dashboardOrder),
    chartType: f.chartType,
    chartMetric: f.chartMetric === 'none' ? null : f.chartMetric,
    mandatory: f.mandatory,
  };
}

/** Live check of a formula: syntax, unknown codes, circular references (PAR-06), same rules as the API. */
function useFormulaCheck(code: string, formula: string, mode: string, params: ParameterDto[], constants: string[]) {
  return useMemo(() => {
    if (mode === 'typed' || !formula.trim())
      return { ok: false, refs: [] as string[], error: mode === 'typed' ? null : 'A formula is required' };
    try {
      const refs = [...formulaRefs(parseFormula(formula))];
      const known = new Set([...params.map((p) => p.code), ...constants, code]);
      const unknown = refs.filter((r) => !known.has(r));
      if (unknown.length)
        return { ok: false, refs, error: `Unknown code${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}` };
      const formulas: Record<string, string> = {};
      for (const p of params) if (p.inputMode !== 'typed' && p.formula && p.code !== code) formulas[p.code] = p.formula;
      formulas[code || '__NEW__'] = formula;
      orderCalculated(formulas);
      return { ok: true, refs, error: null };
    } catch (e) {
      return { ok: false, refs: [], error: (e as Error).message };
    }
  }, [code, formula, mode, params, constants]);
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-line border-t pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-ink-400 mb-3 text-[11px] font-semibold tracking-wider uppercase">{title}</h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** Create / view / edit one parameter, its standards history, and deactivation (PAR-01…PAR-17). */
export function ParameterDrawer({
  open,
  onOpenChange,
  param,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** null = create a new parameter */
  param: ParameterDto | null;
}) {
  const { plant } = usePlant();
  const qc = useQueryClient();
  const canEdit = useCanEditSettings();
  const paramsQ = useSettings('parameters');
  const constQ = useSettings('constants');
  const params = useMemo(() => paramsQ.data ?? [], [paramsQ.data]);
  const constCodes = useMemo(() => [...new Set((constQ.data ?? []).map((c) => c.code))], [constQ.data]);
  const [tab, setTab] = useState<'details' | 'standards'>('details');
  const [form, setForm] = useState<Form>(() => (param ? fromDto(param) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [std, setStd] = useState({ std: '', monthly: '', min: '', max: '' });
  const [stdEff, setStdEff] = useState<EffectiveValue>(EFFECTIVE_TODAY);
  const [stdErrors, setStdErrors] = useState<Record<string, string>>({});
  const [deact, setDeact] = useState(false);
  const [deactEff, setDeactEff] = useState<EffectiveValue>(EFFECTIVE_TODAY);
  const formulaRef = useRef<HTMLTextAreaElement>(null);
  const check = useFormulaCheck(form.code, form.formula, form.inputMode, params, constCodes);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const isNew = !param;
  const inactive = !!param?.activeTo;
  const editable = canEdit && !inactive;

  const listKey = qk.client.settings(plant.id, 'parameters');
  const putInList = (p: ParameterDto) => {
    qc.setQueryData<ParameterDto[]>(listKey, (old) =>
      old ? (old.some((x) => x.id === p.id) ? old.map((x) => (x.id === p.id ? p : x)) : [...old, p]) : old,
    );
    void qc.invalidateQueries({
      queryKey: qk.client.plant(plant.id),
      predicate: (q) => q.queryKey[4] !== 'parameters',
    });
  };

  async function save() {
    const body = toBody(form);
    let c;
    if (isNew) {
      const standard = {
        std: numOrUndef(form.std),
        monthly: numOrUndef(form.monthly),
        min: numOrUndef(form.min),
        max: numOrUndef(form.max),
      };
      const hasStd = Object.values(standard).some((v) => v !== undefined);
      c = checkBody(parameterCreateBody, { code: form.code, ...body, standard: hasStd ? standard : undefined });
    } else {
      const before = toBody(fromDto(param));
      const patch = Object.fromEntries(
        Object.entries(body).filter(
          ([k, v]) => JSON.stringify(v) !== JSON.stringify((before as Record<string, unknown>)[k]),
        ),
      );
      if (Object.keys(patch).length === 0) return toast.message('Nothing changed');
      c = checkBody(parameterPatchBody, patch);
    }
    if (!c.ok) return setErrors(c.errors);
    if (form.inputMode !== 'typed' && !check.ok) return setErrors({ formula: check.error ?? 'Invalid formula' });
    setErrors({});
    setBusy(true);
    try {
      const p = isNew
        ? await clientApi.post<ParameterDto>(`/plants/${plant.id}/settings/parameters`, c.data)
        : await clientApi.patch<ParameterDto>(`/plants/${plant.id}/settings/parameters/${param.id}`, c.data);
      putInList(p);
      toast.success(isNew ? `Parameter ${p.code} added` : 'Parameter saved', {
        description: isNew ? 'It appears on logsheets from today.' : undefined,
      });
      onOpenChange(false);
    } catch (e) {
      setErrors(apiErrors(e));
    } finally {
      setBusy(false);
    }
  }

  async function addStandard() {
    if (!param) return;
    const c = checkBody(standardCreateBody, {
      std: numOrNull(std.std),
      monthly: numOrNull(std.monthly),
      min: numOrNull(std.min),
      max: numOrNull(std.max),
      ...effectiveBody(stdEff),
    });
    const extra = effectiveErrors(stdEff);
    if (!c.ok || Object.keys(extra).length) return setStdErrors({ ...(c.ok ? {} : c.errors), ...extra });
    setStdErrors({});
    setBusy(true);
    try {
      const p = await clientApi.post<ParameterDto>(
        `/plants/${plant.id}/settings/parameters/${param.id}/standards`,
        c.data,
      );
      putInList(p);
      setStd({ std: '', monthly: '', min: '', max: '' });
      setStdEff(EFFECTIVE_TODAY);
      toast.success('Standard saved', { description: 'Reports from that date are recalculated.' });
    } catch (e) {
      setStdErrors(apiErrors(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    if (!param) return;
    const extra = effectiveErrors(deactEff);
    if (Object.keys(extra).length) return setStdErrors(extra);
    setBusy(true);
    try {
      const p = await clientApi.post<ParameterDto>(
        `/plants/${plant.id}/settings/parameters/${param.id}/deactivate`,
        effectiveBody(deactEff),
      );
      putInList(p);
      toast.success(`${p.code} deactivated`, {
        description: 'History is kept; it no longer appears on new logsheets.',
      });
      setDeact(false);
      onOpenChange(false);
    } catch (e) {
      apiErrors(e);
    } finally {
      setBusy(false);
    }
  }

  const insert = (code: string) => {
    const el = formulaRef.current;
    const s = form.formula;
    const at = el?.selectionStart ?? s.length;
    const next = `${s.slice(0, at)}${s && !/\s$/.test(s.slice(0, at)) ? ' ' : ''}${code}${s.slice(at)}`;
    set('formula', next);
    requestAnimationFrame(() => el?.focus());
  };

  const sel = (k: keyof Form, label: string, options: Array<{ value: string; label: string }>, hint?: string) => (
    <Field label={label} hint={hint} error={errors[k]}>
      <Select
        value={String(form[k])}
        onValueChange={(v) => set(k, v as never)}
        options={options}
        disabled={!editable}
      />
    </Field>
  );
  const inp = (
    k: keyof Form,
    label: string,
    props: { hint?: string; mono?: boolean; numeric?: boolean; required?: boolean } = {},
  ) => (
    <Field label={label} hint={props.hint} error={errors[k]} required={props.required}>
      <Input
        value={String(form[k])}
        disabled={!editable || (k === 'code' && !isNew)}
        invalid={!!errors[k]}
        inputMode={props.numeric ? 'decimal' : undefined}
        className={cn(props.mono && 'font-mono uppercase')}
        onChange={(e) => set(k, (k === 'code' ? e.target.value.toUpperCase() : e.target.value) as never)}
      />
    </Field>
  );

  const details = (
    <div className="space-y-6">
      {param?.linkRole && (
        <div className="border-brand-100 bg-brand-50 flex items-start gap-3 rounded-xl border p-3.5">
          <Link2 className="text-brand-500 mt-0.5 size-4 shrink-0" />
          <p className="text-ink-700 text-[13px]">
            Linked to <b>{LINK_ROLE_LABEL[param.linkRole] ?? param.linkRole}</b>. It was created with that item; rename
            or retire the item in its own section.
          </p>
        </div>
      )}
      <Group title="Basics">
        {inp('code', 'Code', { mono: true, required: true, hint: 'UPPER_CASE, used in formulas and imports' })}
        {inp('name', 'Name', { required: true })}
        {inp('shortName', 'Short name', { hint: 'Used on dashboard cards' })}
        {sel('groupKey', 'Group', opt(GROUP_LABEL))}
        {inp('unit', 'Unit', { required: true })}
        {inp('decimals', 'Decimals', { numeric: true })}
      </Group>
      <Group title="Input">
        <div className="sm:col-span-2">
          <p className="text-ink-700 mb-1.5 text-[13px] font-medium">How the value is entered</p>
          <Segmented
            value={form.inputMode}
            onChange={(v) => editable && set('inputMode', v)}
            items={[
              { value: 'typed', label: 'Typed' },
              { value: 'calculated', label: 'Calculated' },
              { value: 'suggested', label: 'Suggested' },
            ]}
          />
        </div>
        <AnimatePresence initial={false}>
          {form.inputMode !== 'typed' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden sm:col-span-2"
            >
              <Field
                label="Formula"
                error={errors.formula ?? check.error}
                hint="Codes of parameters and constants, numbers, + − × ÷, brackets and MIN, MAX, ABS, ROUND."
              >
                <Textarea
                  ref={formulaRef}
                  rows={2}
                  value={form.formula}
                  disabled={!editable}
                  invalid={!!(errors.formula ?? check.error)}
                  className="font-mono text-[13px]"
                  placeholder="DG_HRS * DG_CAPACITY_KW * DG_LOAD_FACTOR"
                  onChange={(e) => set('formula', e.target.value.toUpperCase())}
                />
              </Field>
              <div className="mt-2 flex items-center gap-2 text-xs">
                {check.ok ? (
                  <span className="text-success-600 inline-flex items-center gap-1 font-semibold">
                    <CircleCheck className="size-3.5" /> Formula is valid
                  </span>
                ) : check.error ? (
                  <span className="text-danger-600 inline-flex items-center gap-1 font-semibold">
                    <CircleX className="size-3.5" /> {check.error}
                  </span>
                ) : null}
              </div>
              {editable && (
                <div className="mt-3 space-y-2">
                  {(
                    [
                      ['Constants', constCodes],
                      [
                        'Parameters',
                        params
                          .filter((p) => !p.activeTo && p.code !== form.code && p.aggregation !== 'text')
                          .map((p) => p.code),
                      ],
                    ] as const
                  ).map(([label, codes]) => (
                    <div key={label}>
                      <p className="text-ink-400 mb-1 text-[10px] font-semibold tracking-wider uppercase">
                        {label} · click to insert
                      </p>
                      <div className="scrollbar-thin flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                        {codes.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => insert(c)}
                            className={cn(
                              'rounded-md border px-1.5 py-0.5 font-mono text-[11px] transition-colors',
                              check.refs.includes(c)
                                ? 'border-brand-300 bg-brand-50 text-brand-600'
                                : 'border-line bg-canvas text-ink-500 hover:border-ink-300 hover:text-ink-900',
                            )}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {inp('hardMin', 'Lowest allowed value', { numeric: true, hint: 'Hard limit — values below are refused' })}
        {inp('hardMax', 'Highest allowed value', { numeric: true, hint: 'Leave empty for no limit' })}
        <div className="sm:col-span-2">
          <ToggleRow
            title="Mandatory"
            description="The logsheet cannot be submitted without it."
            control={
              <Switch checked={form.mandatory} disabled={!editable} onCheckedChange={(v) => set('mandatory', v)} />
            }
          />
        </div>
      </Group>
      <Group title="Reporting behaviour">
        {sel('aggregation', 'Month & year totals', opt(AGG))}
        {sel('stdType', 'Standard type', opt(STD))}
        {sel('direction', 'Good direction', opt(DIR), 'Decides blue (favourable) vs red badges')}
        {sel('eventRule', 'Count an event when', opt(EVT))}
        {inp('resultNoun', 'Result label on the MIS', { hint: 'e.g. POWER CONSUMED' })}
      </Group>
      <Group title="Where it appears">
        {sel(
          'logsheetBlock',
          'Logsheet block',
          opt(Object.fromEntries(Object.entries(BLOCK_LABEL).map(([k, v]) => [k, `${k} · ${v}`]))),
        )}
        {inp('logsheetOrder', 'Order in the block', { numeric: true })}
        {sel('misSection', 'MIS report section', opt(MIS))}
        {inp('misOrder', 'Order on the MIS', { numeric: true })}
        <div className="sm:col-span-2">
          <ToggleRow
            title="Dashboard card"
            description="Show a parameter card with a 5-month chart on the dashboard."
            control={
              <Switch
                checked={form.dashboardCard}
                disabled={!editable}
                onCheckedChange={(v) => set('dashboardCard', v)}
              />
            }
          />
        </div>
        {form.dashboardCard && (
          <>
            {sel('chartType', 'Card chart', opt(CHART))}
            {sel('chartMetric', 'Chart value', opt(METRIC))}
            {inp('dashboardOrder', 'Order on the dashboard', { numeric: true })}
          </>
        )}
      </Group>
      {isNew && (
        <Group title="Standard (from the MIS start)">
          {inp('std', 'Standard per day', { numeric: true })}
          {inp('monthly', 'Monthly allowance', { numeric: true })}
          {inp('min', 'Lower limit', { numeric: true })}
          {inp('max', 'Upper limit', { numeric: true })}
        </Group>
      )}
    </div>
  );

  const standards = param && (
    <div className="space-y-6">
      {param.standards.length ? (
        <HistoryList rows={param.standards} render={(r) => standardText(param, r)} />
      ) : (
        <p className="text-ink-500 text-sm">No standard yet.</p>
      )}
      {editable && (
        <div className="rounded-inner border-line space-y-4 border p-4">
          <p className="text-ink-900 text-sm font-semibold">Set a new standard</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['std', 'Standard per day'],
                ['monthly', 'Monthly allowance'],
                ['min', 'Lower limit'],
                ['max', 'Upper limit'],
              ] as const
            ).map(([k, l]) => (
              <Field key={k} label={l} error={stdErrors[k]}>
                <Input inputMode="decimal" value={std[k]} onChange={(e) => setStd({ ...std, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <EffectiveFields value={stdEff} onChange={setStdEff} errors={stdErrors} />
          <div className="flex justify-end">
            <Button onClick={addStandard} loading={busy}>
              <Plus /> Save standard
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        width="lg"
        title={
          isNew ? (
            'Add a parameter'
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              {param.name}
              <span className="bg-muted-bg text-ink-500 rounded-md px-1.5 py-0.5 font-mono text-xs">{param.code}</span>
              {param.inputMode === 'calculated' && (
                <Badge tone="brand" size="sm">
                  <Calculator /> Calculated
                </Badge>
              )}
              {inactive && <Badge size="sm">Inactive</Badge>}
            </span>
          )
        }
        description={
          isNew
            ? 'It appears on the logsheet from today; earlier days are not affected.'
            : `${GROUP_LABEL[param.groupKey]} · ${param.unit}`
        }
        footer={
          <div className="flex w-full items-center gap-2">
            {!isNew && editable && !param.linkRole && tab === 'details' && (
              <Button variant="danger-soft" onClick={() => setDeact(true)}>
                <Ban /> Deactivate
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {editable ? 'Cancel' : 'Close'}
            </Button>
            {editable && tab === 'details' && (
              <Button onClick={save} loading={busy}>
                {isNew ? 'Add parameter' : 'Save changes'}
              </Button>
            )}
          </div>
        }
      >
        {!isNew && (
          <Tabs
            className="mb-6"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'details', label: 'Details' },
              { value: 'standards', label: 'Standards', count: param.standards.length },
            ]}
          />
        )}
        {tab === 'details' || isNew ? details : standards}
      </Drawer>
      <Modal
        open={deact}
        onOpenChange={(o) => !busy && setDeact(o)}
        tone="danger"
        icon={<Ban />}
        title={`Deactivate ${param?.code}?`}
        description="It disappears from logsheets and reports from the chosen date. Values entered before stay in the history."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeact(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={deactivate} loading={busy}>
              Deactivate
            </Button>
          </>
        }
      >
        <EffectiveFields value={deactEff} onChange={setDeactEff} errors={stdErrors} label="Remove from" />
      </Modal>
    </>
  );
}
