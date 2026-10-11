'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { DateField } from '@/components/date/date-field';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Checkbox, Switch } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/tabs';
import { clientApi } from '@/lib/api';
import { fmtDate, fmtNum } from '@/lib/format';
import { generalPatchBody } from '@/shared/schemas/settings';
import { usePlant } from '../plant-context';
import { Fact, PanelCard, SectionHeader, SectionSkeleton, ToggleRow, useCanEditSettings } from './parts';
import { apiErrors, checkBody, useSettings, useSettingsWrite } from './queries';
import type { GeneralSettings } from './types';

type Form = {
  displayName: string;
  misStart: string;
  endCustomerName: string;
  reportCompanyName: string;
  logsheetTitle: string;
  dashboardTitle: string;
  tagline: string;
  sigPreparedLabel: string;
  sigCheckedLabel: string;
  sigVerifiedLabel: string;
  allowSameDay: boolean;
  editorBackfillDays: string;
  avgDivisor: 'calendar_days' | 'data_days';
  pdfPrefixMis: string;
};
const toForm = (g: GeneralSettings): Form => ({
  displayName: g.name,
  misStart: g.misStart,
  endCustomerName: g.endCustomerName ?? '',
  reportCompanyName: g.reportCompanyName ?? '',
  logsheetTitle: g.logsheetTitle ?? '',
  dashboardTitle: g.dashboardTitle ?? '',
  tagline: g.tagline,
  sigPreparedLabel: g.sigPreparedLabel,
  sigCheckedLabel: g.sigCheckedLabel,
  sigVerifiedLabel: g.sigVerifiedLabel,
  allowSameDay: g.allowSameDay,
  editorBackfillDays: String(g.editorBackfillDays),
  avgDivisor: g.avgDivisor,
  pdfPrefixMis: g.pdfPrefixMis,
});
const NULLABLE = ['endCustomerName', 'reportCompanyName', 'logsheetTitle', 'dashboardTitle'];

/** §11.1 General: names on reports, entry rules, averages (SET-01…SET-09). */
export function GeneralSection() {
  const { plant } = usePlant();
  const q = useSettings('general');
  const canEdit = useCanEditSettings();
  const [form, setForm] = useState<Form | null>(null);
  const [confirmMis, setConfirmMis] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useSettingsWrite({
    key: 'general',
    request: (id, body: Record<string, unknown>) =>
      clientApi.patch<GeneralSettings>(`/plants/${id}/settings/general`, body),
    success: 'Plant settings saved',
  });

  useEffect(() => {
    if (q.data) setForm(toForm(q.data));
  }, [q.data]);

  const base = useMemo(() => (q.data ? toForm(q.data) : null), [q.data]);
  const changed = useMemo(() => {
    if (!form || !base) return {} as Partial<Form>;
    return Object.fromEntries(
      (Object.keys(form) as Array<keyof Form>).filter((k) => form[k] !== base[k]).map((k) => [k, form[k]]),
    ) as Partial<Form>;
  }, [form, base]);
  const dirty = Object.keys(changed).length > 0;

  if (!q.data || !form) return <SectionSkeleton />;
  const g = q.data;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const text = (k: keyof Form, label: string, hint?: string) => (
    <Field label={label} hint={hint} error={errors[k]}>
      <Input
        value={String(form[k])}
        disabled={!canEdit}
        invalid={!!errors[k]}
        onChange={(e) => set(k, e.target.value as never)}
      />
    </Field>
  );

  async function submit() {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(changed)) {
      body[k] = NULLABLE.includes(k) && v === '' ? null : k === 'editorBackfillDays' ? Number(v) : v;
    }
    if (changed.misStart) body.confirmMisStartChange = confirmMis;
    const c = checkBody(generalPatchBody, body);
    if (!c.ok) return setErrors(c.errors);
    setErrors({});
    try {
      await save.mutateAsync(c.data as Record<string, unknown>);
      setConfirmMis(false);
    } catch (e) {
      setErrors(apiErrors(e));
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <SectionHeader
        title="General"
        description="How this plant appears on the logsheet, MIS report, dashboard and PDFs, and the rules for daily entry."
      />
      <PanelCard>
        <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-6">
          <Fact label="Plant code">{g.code}</Fact>
          <Fact label="Type">{g.type}</Fact>
          <Fact label="Capacity">{fmtNum(g.capacityMld)} MLD</Fact>
          <Fact label="O&M start">{fmtDate(g.omStart)}</Fact>
          <Fact label="O&M end">
            {fmtDate(g.omEnd)} <span className="text-ink-400 font-normal">· {g.omTenureMonths} months</span>
          </Fact>
          <Fact label="Status">
            <StatusBadge status={g.setupStatus} size="sm" />
          </Fact>
        </div>
        <p className="text-ink-400 mt-4 text-xs">
          Contract dates and capacity are set by the platform team when the plant is created.
        </p>
      </PanelCard>

      <PanelCard>
        <h3 className="text-ink-900 mb-4 text-base font-semibold">Names on reports</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          {text('displayName', 'Plant display name')}
          {text('endCustomerName', 'End customer', 'e.g. the municipal body you operate for')}
          {text('reportCompanyName', 'Company name on reports')}
          {text('tagline', 'Tagline')}
          {text('logsheetTitle', 'Logsheet title')}
          {text('dashboardTitle', 'Dashboard title')}
          {text('pdfPrefixMis', 'MIS PDF file prefix')}
        </div>
      </PanelCard>

      <PanelCard>
        <h3 className="text-ink-900 mb-4 text-base font-semibold">Signature labels</h3>
        <div className="grid gap-5 sm:grid-cols-3">
          {text('sigPreparedLabel', 'Prepared by')}
          {text('sigCheckedLabel', 'Checked by')}
          {text('sigVerifiedLabel', 'Verified by')}
        </div>
      </PanelCard>

      <PanelCard>
        <h3 className="text-ink-900 mb-4 text-base font-semibold">Daily entry & calculations</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          <Field
            label="MIS start date"
            error={errors.misStart}
            hint="The first day reports count. Once logsheets exist it can only move earlier."
          >
            <DateField
              value={form.misStart}
              onChange={(d) => d && set('misStart', d)}
              min={plant.omStart}
              max={plant.omEnd}
              disabled={!canEdit}
            />
          </Field>
          <Field
            label="Editor back-fill window (days)"
            error={errors.editorBackfillDays}
            hint="How many past days an Editor may still fill. Client Admins are not limited."
          >
            <Input
              inputMode="numeric"
              value={form.editorBackfillDays}
              disabled={!canEdit}
              invalid={!!errors.editorBackfillDays}
              onChange={(e) => set('editorBackfillDays', e.target.value)}
            />
          </Field>
          <ToggleRow
            title="Allow same-day entry"
            description="Off: a day's logsheet opens after midnight (recommended for 24-hour totals)."
            control={
              <Switch checked={form.allowSameDay} disabled={!canEdit} onCheckedChange={(v) => set('allowSameDay', v)} />
            }
          />
          <div className="rounded-inner border-line border p-4">
            <p className="text-ink-900 text-sm font-semibold">Averages divide by</p>
            <p className="text-ink-500 mt-0.5 mb-3 text-xs">Changing this recalculates every report.</p>
            <Segmented
              size="sm"
              value={form.avgDivisor}
              onChange={(v) => canEdit && set('avgDivisor', v)}
              items={[
                { value: 'calendar_days', label: 'Calendar days' },
                { value: 'data_days', label: 'Days with data' },
              ]}
            />
          </div>
        </div>
        <AnimatePresence>
          {changed.misStart && (
            <motion.label
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-warning-100 bg-warning-50 mt-5 flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl border p-3.5"
            >
              <Checkbox checked={confirmMis} onCheckedChange={setConfirmMis} aria-label="Confirm MIS start change" />
              <span className="text-ink-700 text-[13px]">
                I understand that moving the MIS start to <b>{fmtDate(changed.misStart)}</b> recalculates every report
                and archived PDF from that date.
              </span>
            </motion.label>
          )}
        </AnimatePresence>
      </PanelCard>

      <AnimatePresence>
        {dirty && canEdit && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="border-line bg-surface/95 shadow-float sticky bottom-4 z-20 flex items-center gap-3 rounded-2xl border p-3 pl-5 backdrop-blur"
          >
            <span className="bg-warning-500 size-2 rounded-full" />
            <p className="text-ink-700 flex-1 text-sm font-medium">
              {Object.keys(changed).length} unsaved change{Object.keys(changed).length > 1 ? 's' : ''}
            </p>
            <Button variant="ghost" onClick={() => base && (setForm(base), setErrors({}))} disabled={save.isPending}>
              Discard
            </Button>
            <Button onClick={submit} loading={save.isPending} disabled={!!changed.misStart && !confirmMis}>
              Save changes
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
