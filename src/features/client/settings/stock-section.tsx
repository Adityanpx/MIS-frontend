'use client';

import { ArrowDownUp, Package, PencilLine, Plus, Power } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { DateField } from '@/components/date/date-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardMenu } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { clientApi } from '@/lib/api';
import { addDays } from '@/lib/dates';
import { fmtDate, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { stockAdjustmentBody, stockItemCreateBody, stockItemPatchBody } from '@/shared/schemas/settings';
import { usePlant } from '../plant-context';
import { numOrNull, numOrUndef, SectionHeader, SectionSkeleton, str, useCanEditSettings } from './parts';
import { apiErrors, checkBody, useSettings, useSettingsWrite } from './queries';
import type { StockItemDto } from './types';

type ItemForm = {
  name: string;
  unit: string;
  code: string;
  stdPerDay: string;
  openingBalance: string;
  openingDate: string | null;
  minLevel: string;
  reason: string;
};

/** §11.5 Chemicals & consumables: opening balances, minimum levels, dated adjustments (STK-01…STK-06). */
export function StockSection() {
  const { plant } = usePlant();
  const q = useSettings('stock-items');
  const canEdit = useCanEditSettings();
  const [form, setForm] = useState<{ item: StockItemDto | null; v: ItemForm } | null>(null);
  const [adj, setAdj] = useState<{ item: StockItemDto; date: string | null; qty: string; reason: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const path = (id: string, p = '') => `/plants/${id}/settings/stock-items${p}`;
  const create = useSettingsWrite({
    key: 'stock-items',
    request: (id, b: unknown) => clientApi.post<StockItemDto[]>(path(id), b),
    success: 'Stock item added — it now has consumed and received rows on the logsheet',
  });
  const patch = useSettingsWrite({
    key: 'stock-items',
    request: (id, b: { itemId: string; body: unknown }) =>
      clientApi.patch<StockItemDto[]>(path(id, `/${b.itemId}`), b.body),
    success: 'Stock item saved',
  });
  const adjust = useSettingsWrite({
    key: null,
    request: (id, b: { itemId: string; body: unknown }) => clientApi.post(path(id, `/${b.itemId}/adjustments`), b.body),
    success: 'Adjustment recorded — balances from that date are recalculated',
  });

  if (!q.data) return <SectionSkeleton />;
  const defaultOpening = addDays(plant.misStart, -1);

  const openForm = (item: StockItemDto | null) => {
    setErrors({});
    setForm({
      item,
      v: item
        ? {
            name: item.name,
            unit: item.unit,
            code: item.code,
            stdPerDay: str(item.stdPerDay),
            openingBalance: str(item.openingBalance),
            openingDate: item.openingDate,
            minLevel: str(item.minLevel),
            reason: '',
          }
        : {
            name: '',
            unit: 'kg',
            code: '',
            stdPerDay: '',
            openingBalance: '0',
            openingDate: defaultOpening,
            minLevel: '',
            reason: '',
          },
    });
  };

  async function saveForm() {
    if (!form) return;
    const v = form.v;
    try {
      if (!form.item) {
        const c = checkBody(stockItemCreateBody, {
          name: v.name,
          unit: v.unit,
          code: v.code.trim() || undefined,
          stdPerDay: numOrUndef(v.stdPerDay),
          openingBalance: numOrUndef(v.openingBalance) ?? 0,
          openingDate: v.openingDate ?? undefined,
          minLevel: numOrNull(v.minLevel),
        });
        if (!c.ok) return setErrors(c.errors);
        await create.mutateAsync(c.data);
      } else {
        const i = form.item;
        const body: Record<string, unknown> = {};
        if (v.name !== i.name) body.name = v.name;
        if (v.unit !== i.unit) body.unit = v.unit;
        if (numOrNull(v.minLevel) !== i.minLevel) body.minLevel = numOrNull(v.minLevel);
        if (numOrNull(v.openingBalance) !== i.openingBalance) body.openingBalance = numOrUndef(v.openingBalance);
        if (v.openingDate !== i.openingDate) body.openingDate = v.openingDate ?? undefined;
        if (v.reason.trim()) body.reason = v.reason.trim();
        const c = checkBody(stockItemPatchBody, body);
        if (!c.ok) return setErrors(c.errors);
        await patch.mutateAsync({ itemId: i.id, body: c.data });
      }
      setForm(null);
    } catch (e) {
      setErrors(apiErrors(e));
    }
  }
  async function saveAdj() {
    if (!adj) return;
    const c = checkBody(stockAdjustmentBody, {
      adjDate: adj.date ?? undefined,
      qty: numOrUndef(adj.qty),
      reason: adj.reason,
    });
    if (!c.ok) return setErrors(c.errors);
    try {
      await adjust.mutateAsync({ itemId: adj.item.id, body: c.data });
      setAdj(null);
    } catch (e) {
      setErrors(apiErrors(e));
    }
  }

  const set = (k: keyof ItemForm, val: string | null) => form && setForm({ ...form, v: { ...form.v, [k]: val } });
  const busy = create.isPending || patch.isPending;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Chemicals & stock"
        description="Each item adds a consumed and a received row to the logsheet. Closing stock = yesterday’s closing − consumed + received, from the opening balance."
        actions={
          <Button onClick={() => openForm(null)}>
            <Plus /> Add stock item
          </Button>
        }
      />
      {q.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package />}
            title="No stock items"
            description="Add the chemicals and fuel the plant consumes."
          />
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {q.data.map((i, n) => (
            <motion.div
              key={i.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: n * 0.04 }}
            >
              <Card className={cn('flex h-full flex-col', !i.isActive && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <span className="bg-brand-50 text-brand-500 grid size-10 place-items-center rounded-xl">
                    <Package className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-ink-900 text-base font-semibold">{i.name}</p>
                    <p className="text-ink-400 font-mono text-[11px]">
                      {i.code} · {i.unit}
                    </p>
                  </div>
                  {!i.isActive && <Badge size="sm">Inactive</Badge>}
                  {canEdit && (
                    <CardMenu
                      items={[
                        { label: 'Edit', icon: <PencilLine />, onSelect: () => openForm(i) },
                        {
                          label: 'Stock adjustment',
                          icon: <ArrowDownUp />,
                          onSelect: () => (setErrors({}), setAdj({ item: i, date: null, qty: '', reason: '' })),
                        },
                        {
                          label: i.isActive ? 'Deactivate' : 'Activate',
                          icon: <Power />,
                          danger: i.isActive,
                          onSelect: () =>
                            void patch.mutateAsync({ itemId: i.id, body: { isActive: !i.isActive } }).catch(apiErrors),
                        },
                      ]}
                    />
                  )}
                </div>
                <div className="mt-5 mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-ink-400 text-[11px] font-medium tracking-wider uppercase">Standard</p>
                    <p className="text-ink-900 tabular text-2xl font-semibold">
                      {fmtNum(i.stdPerDay)} <span className="text-ink-500 text-sm font-medium">{i.unit}/day</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-ink-400 text-[11px] font-medium tracking-wider uppercase">Minimum level</p>
                    <p className="text-ink-900 tabular text-sm font-semibold">
                      {i.minLevel === null ? '—' : `${fmtNum(i.minLevel)} ${i.unit}`}
                    </p>
                  </div>
                </div>
                <div className="bg-canvas mt-auto flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-[13px]">
                  <span className="text-ink-500 whitespace-nowrap">Opening balance</span>
                  <span className="text-right">
                    <span className="text-ink-900 tabular block font-semibold whitespace-nowrap">
                      {fmtNum(i.openingBalance)} {i.unit}
                    </span>
                    <span
                      className={cn(
                        'tabular block text-[11px] whitespace-nowrap',
                        i.openingDate ? 'text-ink-400' : 'text-danger-600',
                      )}
                    >
                      {i.openingDate ? `as of ${fmtDate(i.openingDate)}` : 'date not set'}
                    </span>
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        open={!!form}
        onOpenChange={(o) => !o && !busy && setForm(null)}
        icon={<Package />}
        size="lg"
        title={form?.item ? `Edit ${form.item.name}` : 'Add a stock item'}
        description={
          form?.item
            ? 'The standard per day is changed on the consumed parameter (Parameters → standards).'
            : 'Creates the consumed (with the standard) and received parameters on the logsheet.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={saveForm} loading={busy}>
              {form?.item ? 'Save' : 'Add item'}
            </Button>
          </>
        }
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={errors.name}>
              <Input value={form.v.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Unit" required error={errors.unit}>
              <Input value={form.v.unit} onChange={(e) => set('unit', e.target.value)} />
            </Field>
            {!form.item && (
              <>
                <Field label="Code" error={errors.code} hint="Optional — made from the name">
                  <Input
                    className="font-mono"
                    value={form.v.code}
                    onChange={(e) => set('code', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="Standard per day" required error={errors.stdPerDay}>
                  <Input
                    inputMode="decimal"
                    value={form.v.stdPerDay}
                    onChange={(e) => set('stdPerDay', e.target.value)}
                  />
                </Field>
              </>
            )}
            <Field label="Opening balance" error={errors.openingBalance}>
              <Input
                inputMode="decimal"
                value={form.v.openingBalance}
                onChange={(e) => set('openingBalance', e.target.value)}
              />
            </Field>
            <Field label="Opening balance date" error={errors.openingDate} hint="Usually the day before the MIS start">
              <DateField
                value={form.v.openingDate}
                onChange={(d) => set('openingDate', d)}
                min={plant.omStart}
                max={plant.omEnd}
              />
            </Field>
            <Field label="Minimum level" error={errors.minLevel} hint="Warn when the closing stock falls below">
              <Input inputMode="decimal" value={form.v.minLevel} onChange={(e) => set('minLevel', e.target.value)} />
            </Field>
            {form.item && (
              <Field
                className="sm:col-span-2"
                label="Reason"
                error={errors.reason}
                hint="Needed when changing the opening balance after logsheets exist."
              >
                <Textarea rows={2} value={form.v.reason} onChange={(e) => set('reason', e.target.value)} />
              </Field>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!adj}
        onOpenChange={(o) => !o && !adjust.isPending && setAdj(null)}
        icon={<ArrowDownUp />}
        title={`Stock adjustment · ${adj?.item.name ?? ''}`}
        description="For a physical count difference. Use a minus sign to reduce the stock."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdj(null)}>
              Cancel
            </Button>
            <Button onClick={saveAdj} loading={adjust.isPending}>
              Record adjustment
            </Button>
          </>
        }
      >
        {adj && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required error={errors.adjDate}>
                <DateField
                  value={adj.date}
                  onChange={(d) => setAdj({ ...adj, date: d })}
                  min={plant.misStart}
                  max={plant.omEnd}
                />
              </Field>
              <Field label={`Quantity (${adj.item.unit})`} required error={errors.qty}>
                <Input
                  inputMode="decimal"
                  placeholder="-25"
                  value={adj.qty}
                  onChange={(e) => setAdj({ ...adj, qty: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Reason" required error={errors.reason} hint="At least 10 characters.">
              <Textarea rows={2} value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
