'use client';

import { Plus, Sigma } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { DataTable } from '@/components/ui/table';
import { clientApi } from '@/lib/api';
import { fmtAuto, fmtDate } from '@/lib/format';
import { constantCreateBody } from '@/shared/schemas/settings';
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
import type { ConstantRow } from './types';

interface Grouped {
  code: string;
  name: string;
  unit: string | null;
  current: ConstantRow;
  history: ConstantRow[];
}

/** §11.3 Plant constants used by formulas (capacities, load factors…), effective-dated. */
export function ConstantsSection() {
  const q = useSettings('constants');
  const params = useSettings('parameters');
  const canEdit = useCanEditSettings();
  const [edit, setEdit] = useState<{ code: string; name: string; unit: string; value: string; isNew: boolean } | null>(
    null,
  );
  const [eff, setEff] = useState<EffectiveValue>(EFFECTIVE_TODAY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const write = useSettingsWrite({
    key: 'constants',
    request: (id, body: unknown) => clientApi.post<ConstantRow[]>(`/plants/${id}/settings/constants`, body),
    success: 'Constant saved — formulas use it from the chosen date',
  });

  const groups = useMemo<Grouped[]>(() => {
    const m = new Map<string, ConstantRow[]>();
    for (const c of q.data ?? []) m.set(c.code, [...(m.get(c.code) ?? []), c]);
    return [...m.entries()].map(([code, rows]) => {
      const current = currentOf(rows)!;
      return { code, name: current.name, unit: current.unit, current, history: rows };
    });
  }, [q.data]);
  const usedBy = (code: string) =>
    (params.data ?? []).filter((p) => p.formula && new RegExp(`\\b${code}\\b`).test(p.formula)).map((p) => p.code);

  if (!q.data) return <SectionSkeleton />;
  const selected = edit && !edit.isNew ? groups.find((g) => g.code === edit.code) : undefined;

  async function save() {
    if (!edit) return;
    const c = checkBody(constantCreateBody, {
      code: edit.code,
      name: edit.name,
      value: numOrUndef(edit.value),
      unit: edit.unit.trim() || undefined,
      ...effectiveBody(eff),
    });
    const extra = effectiveErrors(eff);
    if (!c.ok || Object.keys(extra).length) return setErrors({ ...(c.ok ? {} : c.errors), ...extra });
    try {
      await write.mutateAsync(c.data);
      setEdit(null);
    } catch (e) {
      setErrors(apiErrors(e));
    }
  }
  const openEdit = (g: Grouped | null) => {
    setErrors({});
    setEff(EFFECTIVE_TODAY);
    setEdit(
      g
        ? { code: g.code, name: g.name, unit: g.unit ?? '', value: String(g.current.value), isNew: false }
        : { code: '', name: '', unit: '', value: '', isNew: true },
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Constants"
        description="Fixed plant figures that formulas use — for example DG capacity × load factor gives the DG power. A new value applies from its date; older days keep the old value."
        actions={
          <Button onClick={() => openEdit(null)}>
            <Plus /> Add constant
          </Button>
        }
      />
      <Card>
        {groups.length === 0 ? (
          <EmptyState icon={<Sigma />} title="No constants yet" description="Add the figures your formulas need." />
        ) : (
          <DataTable
            rows={groups}
            rowKey={(g) => g.code}
            onRowClick={(g) => openEdit(g)}
            columns={[
              {
                key: 'name',
                header: 'Constant',
                cell: (g) => (
                  <div>
                    <p className="text-ink-900 font-semibold">{g.name}</p>
                    <p className="text-ink-400 font-mono text-[11px]">{g.code}</p>
                  </div>
                ),
              },
              {
                key: 'value',
                header: 'Value today',
                align: 'right',
                cell: (g) => (
                  <span className="text-ink-900 tabular font-semibold">
                    {fmtAuto(g.current.value, 4)} <span className="text-ink-400 font-normal">{g.unit}</span>
                  </span>
                ),
              },
              {
                key: 'from',
                header: 'Since',
                hideBelow: 'sm',
                cell: (g) => <span className="tabular">{fmtDate(g.current.effectiveFrom)}</span>,
              },
              {
                key: 'used',
                header: 'Used by',
                hideBelow: 'md',
                cell: (g) => {
                  const u = usedBy(g.code);
                  return u.length ? (
                    <span className="text-ink-700 font-mono text-[11px]">{u.join(', ')}</span>
                  ) : (
                    <span className="text-ink-400">—</span>
                  );
                },
              },
              {
                key: 'changes',
                header: 'Changes',
                align: 'right',
                hideBelow: 'sm',
                cell: (g) => <span className="text-ink-500">{g.history.length}</span>,
              },
            ]}
          />
        )}
      </Card>
      <Modal
        open={!!edit}
        onOpenChange={(o) => !o && !write.isPending && setEdit(null)}
        icon={<Sigma />}
        size="lg"
        title={edit?.isNew ? 'Add a constant' : `${edit?.name}`}
        description={edit?.isNew ? 'Codes are UPPER_CASE and can be used in any formula.' : `Code ${edit?.code}`}
        footer={
          canEdit ? (
            <>
              <Button variant="ghost" onClick={() => setEdit(null)}>
                Cancel
              </Button>
              <Button onClick={save} loading={write.isPending}>
                {edit?.isNew ? 'Add constant' : 'Save new value'}
              </Button>
            </>
          ) : undefined
        }
      >
        {edit && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              {edit.isNew && (
                <>
                  <Field label="Code" required error={errors.code}>
                    <Input
                      className="font-mono"
                      value={edit.code}
                      onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })}
                    />
                  </Field>
                  <Field label="Name" required error={errors.name}>
                    <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                  </Field>
                </>
              )}
              <div className="grid grid-cols-[1fr_110px] gap-3">
                <Field label={edit.isNew ? 'Value' : 'New value'} required error={errors.value}>
                  <Input
                    inputMode="decimal"
                    disabled={!canEdit}
                    value={edit.value}
                    onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                  />
                </Field>
                <Field label="Unit" error={errors.unit}>
                  <Input
                    disabled={!canEdit || !edit.isNew}
                    value={edit.unit}
                    onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                  />
                </Field>
              </div>
              {canEdit && <EffectiveFields value={eff} onChange={setEff} errors={errors} />}
            </div>
            {selected && (
              <div>
                <p className="text-ink-900 mb-3 text-sm font-semibold">History</p>
                <HistoryList rows={selected.history} render={(r) => `${fmtAuto(r.value, 4)} ${r.unit ?? ''}`} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
