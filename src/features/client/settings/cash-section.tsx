'use client';

import { Banknote, BellRing, Coins, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DateField } from '@/components/date/date-field';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { clientApi } from '@/lib/api';
import { fmtDate, fmtMoney0 } from '@/lib/format';
import { cashPatchBody } from '@/shared/schemas/settings';
import { usePlant } from '../plant-context';
import { numOrNull, PanelCard, SectionHeader, SectionSkeleton, str, useCanEditSettings } from './parts';
import { apiErrors, checkBody, useSettings, useSettingsWrite } from './queries';
import type { CashSettings } from './types';

/** §11.9 Site cash: opening balance, daily alert limit and petty-cash float (CSH-01…CSH-05). */
export function CashSection() {
  const { plant } = usePlant();
  const q = useSettings('cash');
  const canEdit = useCanEditSettings();
  const [v, setV] = useState({
    cashOpening: '',
    cashOpeningDate: null as string | null,
    cashAlertLimit: '',
    pettyFloat: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useSettingsWrite({
    key: 'cash',
    request: (id, b: unknown) => clientApi.patch<CashSettings>(`/plants/${id}/settings/cash`, b),
    success: 'Cash settings saved',
  });
  useEffect(() => {
    if (q.data)
      setV({
        cashOpening: str(q.data.cashOpening),
        cashOpeningDate: q.data.cashOpeningDate,
        cashAlertLimit: str(q.data.cashAlertLimit),
        pettyFloat: str(q.data.pettyFloat),
      });
  }, [q.data]);
  if (!q.data) return <SectionSkeleton rows={1} />;
  const d = q.data;

  async function submit() {
    const body: Record<string, unknown> = {};
    if (numOrNull(v.cashOpening) !== d.cashOpening) body.cashOpening = numOrNull(v.cashOpening) ?? 0;
    if (v.cashOpeningDate && v.cashOpeningDate !== d.cashOpeningDate) body.cashOpeningDate = v.cashOpeningDate;
    if (numOrNull(v.cashAlertLimit) !== d.cashAlertLimit) body.cashAlertLimit = numOrNull(v.cashAlertLimit);
    if (numOrNull(v.pettyFloat) !== d.pettyFloat) body.pettyFloat = numOrNull(v.pettyFloat);
    const c = checkBody(cashPatchBody, body);
    if (!c.ok) return setErrors(c.errors);
    setErrors({});
    try {
      await save.mutateAsync(c.data);
    } catch (e) {
      setErrors(apiErrors(e));
    }
  }

  const tiles = [
    {
      icon: <Wallet />,
      label: 'Opening balance',
      value: fmtMoney0(d.cashOpening),
      sub: `as of ${fmtDate(d.cashOpeningDate)}`,
    },
    {
      icon: <BellRing />,
      label: 'Daily expense alert',
      value: d.cashAlertLimit === null ? 'Off' : fmtMoney0(d.cashAlertLimit),
      sub: 'warns on the logsheet above this',
    },
    {
      icon: <Coins />,
      label: 'Petty cash float',
      value: d.pettyFloat === null ? '—' : fmtMoney0(d.pettyFloat),
      sub: 'normal cash kept on site',
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Site cash"
        description="Cash in hand = yesterday’s cash − expenses + cash received, starting from the opening balance. Expenses above the alert limit are flagged on the logsheet and the dashboard."
      />
      <div className="grid gap-6 sm:grid-cols-3">
        {tiles.map((t) => (
          <PanelCard key={t.label}>
            <span className="bg-brand-50 text-brand-500 grid size-10 place-items-center rounded-xl [&_svg]:size-5">
              {t.icon}
            </span>
            <p className="text-ink-500 mt-4 text-sm">{t.label}</p>
            <p className="text-ink-900 tabular mt-1 text-2xl font-semibold">{t.value}</p>
            <p className="text-ink-400 mt-1 text-xs">{t.sub}</p>
          </PanelCard>
        ))}
      </div>
      {canEdit && (
        <PanelCard>
          <h3 className="text-ink-900 mb-4 flex items-center gap-2 text-base font-semibold">
            <Banknote className="text-brand-500 size-5" /> Change
          </h3>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Opening balance (₹)" error={errors.cashOpening}>
              <Input
                inputMode="decimal"
                value={v.cashOpening}
                onChange={(e) => setV({ ...v, cashOpening: e.target.value })}
              />
            </Field>
            <Field label="Opening balance date" error={errors.cashOpeningDate}>
              <DateField
                value={v.cashOpeningDate}
                onChange={(x) => setV({ ...v, cashOpeningDate: x })}
                min={plant.omStart}
                max={plant.omEnd}
              />
            </Field>
            <Field label="Daily expense alert (₹)" error={errors.cashAlertLimit} hint="Empty = no alert">
              <Input
                inputMode="decimal"
                value={v.cashAlertLimit}
                onChange={(e) => setV({ ...v, cashAlertLimit: e.target.value })}
              />
            </Field>
            <Field label="Petty cash float (₹)" error={errors.pettyFloat}>
              <Input
                inputMode="decimal"
                value={v.pettyFloat}
                onChange={(e) => setV({ ...v, pettyFloat: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <Button onClick={submit} loading={save.isPending}>
              Save cash settings
            </Button>
          </div>
        </PanelCard>
      )}
    </div>
  );
}
