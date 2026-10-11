'use client';

import { HardHat, PencilLine, Plus, Power, TrendingUp, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardMenu } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { clientApi } from '@/lib/api';
import { fmtDate, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  itemPatchBody,
  requirementBody,
  safetyCreateBody,
  staffCreateBody,
  strengthBody,
} from '@/shared/schemas/settings';
import {
  currentOf,
  EFFECTIVE_TODAY,
  EffectiveFields,
  effectiveBody,
  effectiveErrors,
  HistoryList,
  numOrUndef,
  SectionHeader,
  SectionSkeleton,
  useCanEditSettings,
  type EffectiveValue,
} from './parts';
import { apiErrors, checkBody, useSettings, useSettingsWrite } from './queries';
import type { SafetyDto, StaffDto } from './types';

type Kind = 'staff' | 'safety';
interface Row {
  id: string;
  name: string;
  isActive: boolean;
  history: Array<{ effectiveFrom: string; value: number; reason: string | null }>;
}
const COPY = {
  staff: {
    title: 'Staff strength',
    description:
      'Contracted manpower per category. The logsheet records vacant, present and on-leave; absent is worked out from the strength in force that day.',
    add: 'Add category',
    value: 'Strength',
    unit: 'people',
    icon: Users,
    codeHint: 'Logsheet codes become STAFF_<CODE>_VACANT / _PRESENT / _LEAVE',
  },
  safety: {
    title: 'Safety items',
    description:
      'Safety equipment the contract requires on site. The logsheet records how many are available each day.',
    add: 'Add safety item',
    value: 'Required quantity',
    unit: 'nos',
    icon: HardHat,
    codeHint: 'Logsheet code becomes SAFE_<CODE>',
  },
} as const;

/** §11.7 Staff categories and §11.8 safety items — the same effective-dated pattern (STF-*, SAF-*). */
export function PeopleSection({ kind }: { kind: Kind }) {
  const key = kind === 'staff' ? 'staff' : 'safety';
  const q = useSettings(key);
  const canEdit = useCanEditSettings();
  const t = COPY[kind];
  const Icon = t.icon;
  const [mode, setMode] = useState<{ type: 'add' | 'value' | 'rename'; row: Row | null } | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');
  const [eff, setEff] = useState<EffectiveValue>(EFFECTIVE_TODAY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const base = (id: string) => `/plants/${id}/settings/${key}`;
  const write = useSettingsWrite({
    key,
    request: (id, b: { path: string; method: 'post' | 'patch'; body: unknown }) =>
      clientApi[b.method]<StaffDto[] | SafetyDto[]>(`${base(id)}${b.path}`, b.body) as never,
    success: 'Saved',
  });

  if (!q.data) return <SectionSkeleton />;
  const rows: Row[] =
    kind === 'staff'
      ? (q.data as StaffDto[]).map((s) => ({
          id: s.id,
          name: s.name,
          isActive: s.isActive,
          history: s.strengths.map((x) => ({ effectiveFrom: x.effectiveFrom, value: x.strength, reason: x.reason })),
        }))
      : (q.data as SafetyDto[]).map((s) => ({
          id: s.id,
          name: s.name,
          isActive: s.isActive,
          history: s.requirements.map((x) => ({ effectiveFrom: x.effectiveFrom, value: x.qty, reason: x.reason })),
        }));
  const total = rows.filter((r) => r.isActive).reduce((s, r) => s + (currentOf(r.history)?.value ?? 0), 0);

  const open = (type: 'add' | 'value' | 'rename', row: Row | null) => {
    setErrors({});
    setEff(EFFECTIVE_TODAY);
    setName(row?.name ?? '');
    setCode('');
    setValue(row ? String(currentOf(row.history)?.value ?? '') : '');
    setMode({ type, row });
  };

  async function save() {
    if (!mode) return;
    let req: { path: string; method: 'post' | 'patch'; body: unknown } | null = null;
    if (mode.type === 'add') {
      const c =
        kind === 'staff'
          ? checkBody(staffCreateBody, { name, code: code.trim() || undefined, strength: numOrUndef(value) })
          : checkBody(safetyCreateBody, { name, code: code.trim() || undefined, qty: numOrUndef(value) });
      if (!c.ok) return setErrors(c.errors);
      req = { path: '', method: 'post', body: c.data };
    } else if (mode.type === 'value' && mode.row) {
      const body = { [kind === 'staff' ? 'strength' : 'qty']: numOrUndef(value), ...effectiveBody(eff) };
      const c = kind === 'staff' ? checkBody(strengthBody, body) : checkBody(requirementBody, body);
      const extra = effectiveErrors(eff);
      if (!c.ok || Object.keys(extra).length) return setErrors({ ...(c.ok ? {} : c.errors), ...extra });
      req = {
        path: `/${mode.row.id}/${kind === 'staff' ? 'strengths' : 'requirements'}`,
        method: 'post',
        body: c.data,
      };
    } else if (mode.row) {
      const c = checkBody(itemPatchBody, { name });
      if (!c.ok) return setErrors(c.errors);
      req = { path: `/${mode.row.id}`, method: 'patch', body: c.data };
    }
    if (!req) return;
    try {
      await write.mutateAsync(req);
      setMode(null);
    } catch (e) {
      setErrors(apiErrors(e));
    }
  }

  const valueKey = kind === 'staff' ? 'strength' : 'qty';
  return (
    <div className="space-y-6">
      <SectionHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => open('add', null)}>
            <Plus /> {t.add}
          </Button>
        }
      />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Icon />} title="Nothing here yet" description={t.description} />
        </Card>
      ) : (
        <>
          <div className="border-line bg-surface inline-flex items-baseline gap-2 rounded-full border px-4 py-2">
            <span className="text-ink-900 tabular text-base font-bold">{fmtNum(total)}</span>
            <span className="text-ink-500 text-xs">
              {kind === 'staff' ? 'people contracted today' : 'items required on site today'}
            </span>
          </div>
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((r, n) => {
              const cur = currentOf(r.history);
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: n * 0.04 }}
                >
                  <Card className={cn('h-full', !r.isActive && 'opacity-60')}>
                    <div className="flex items-start gap-3">
                      <span className="bg-brand-50 text-brand-500 grid size-10 place-items-center rounded-xl">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-ink-900 text-base font-semibold">{r.name}</p>
                        <p className="text-ink-500 text-xs">
                          {r.history.length} change{r.history.length === 1 ? '' : 's'}
                          {cur && ` · since ${fmtDate(cur.effectiveFrom)}`}
                        </p>
                      </div>
                      {!r.isActive && <Badge size="sm">Inactive</Badge>}
                      {canEdit && (
                        <CardMenu
                          items={[
                            {
                              label: `Change ${t.value.toLowerCase()}`,
                              icon: <TrendingUp />,
                              onSelect: () => open('value', r),
                            },
                            { label: 'Rename', icon: <PencilLine />, onSelect: () => open('rename', r) },
                            {
                              label: r.isActive ? 'Deactivate' : 'Activate',
                              icon: <Power />,
                              danger: r.isActive,
                              onSelect: () =>
                                void write
                                  .mutateAsync({ path: `/${r.id}`, method: 'patch', body: { isActive: !r.isActive } })
                                  .catch(apiErrors),
                            },
                          ]}
                        />
                      )}
                    </div>
                    <p className="text-ink-900 tabular mt-5 text-[32px] leading-none font-semibold tracking-tight">
                      {fmtNum(cur?.value ?? 0)}
                      <span className="text-ink-500 ml-2 text-sm font-medium">{t.unit}</span>
                    </p>
                    {r.history.length > 1 && (
                      <div className="mt-4 flex items-end gap-1">
                        {[...r.history]
                          .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
                          .map((h, i, arr) => {
                            const max = Math.max(...arr.map((x) => x.value), 1);
                            return (
                              <motion.span
                                key={i}
                                className={cn(
                                  'w-full rounded-md',
                                  i === arr.length - 1 ? 'bg-brand-500' : 'bg-brand-100',
                                )}
                                initial={{ height: 0 }}
                                animate={{ height: 8 + (h.value / max) * 28 }}
                                transition={{ delay: 0.1 + i * 0.05 }}
                                title={`${fmtNum(h.value)} from ${fmtDate(h.effectiveFrom)}`}
                              />
                            );
                          })}
                      </div>
                    )}
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={!!mode}
        onOpenChange={(o) => !o && !write.isPending && setMode(null)}
        icon={<Icon />}
        size={mode?.type === 'value' ? 'lg' : 'md'}
        title={
          mode?.type === 'add'
            ? t.add
            : mode?.type === 'rename'
              ? `Rename ${mode.row?.name}`
              : `${t.value} · ${mode?.row?.name ?? ''}`
        }
        description={mode?.type === 'add' ? t.codeHint : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={write.isPending}>
              Save
            </Button>
          </>
        }
      >
        {mode && (
          <div className={cn('grid gap-6', mode.type === 'value' && 'sm:grid-cols-2')}>
            <div className="space-y-4">
              {mode.type !== 'value' && (
                <Field label="Name" required error={errors.name}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              )}
              {mode.type === 'add' && (
                <Field label="Code" hint="Optional — made from the name" error={errors.code}>
                  <Input className="font-mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
                </Field>
              )}
              {mode.type !== 'rename' && (
                <Field
                  label={mode.type === 'value' ? `New ${t.value.toLowerCase()}` : t.value}
                  required
                  error={errors[valueKey]}
                >
                  <Input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
                </Field>
              )}
              {mode.type === 'value' && <EffectiveFields value={eff} onChange={setEff} errors={errors} />}
            </div>
            {mode.type === 'value' && mode.row && (
              <div>
                <p className="text-ink-900 mb-3 text-sm font-semibold">History</p>
                <HistoryList rows={mode.row.history} render={(r) => `${fmtNum(r.value)} ${t.unit}`} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
