'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Copy, FileSpreadsheet, LayoutTemplate, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { clientApi } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { usePlant } from '../plant-context';
import { usePlants } from '../queries';
import { PanelCard, SectionHeader, useCanEditSettings } from './parts';
import { apiErrors, useSettings } from './queries';
import type { ParameterDto } from './types';

/** §11.13 Start from the STP template or copy another plant's settings (TPL-01/02), plus the import entry. */
export function TemplateSection() {
  const { plant, can } = usePlant();
  const canEdit = useCanEditSettings();
  const plants = usePlants();
  const qc = useQueryClient();
  const [ask, setAsk] = useState<'template' | 'copy' | null>(null);
  const [source, setSource] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const paramCount = useSettings('parameters').data?.length ?? 0;
  const others = (plants.data ?? []).filter((p) => p.id !== plant.id && p.setupStatus !== 'closed');

  async function run() {
    setBusy(true);
    try {
      const list =
        ask === 'template'
          ? await clientApi.post<ParameterDto[]>(`/plants/${plant.id}/settings/apply-template`)
          : await clientApi.post<ParameterDto[]>(`/plants/${plant.id}/settings/copy-from`, { sourcePlantId: source });
      qc.setQueryData(qk.client.settings(plant.id, 'parameters'), list);
      void qc.invalidateQueries({ queryKey: qk.client.plant(plant.id) });
      toast.success(ask === 'template' ? 'STP template applied' : 'Settings copied', {
        description: 'Review the parameters, standards and opening balances, then complete the checklist.',
      });
      setAsk(null);
    } catch (e) {
      apiErrors(e);
    } finally {
      setBusy(false);
    }
  }

  const sourceName = others.find((p) => p.id === source)?.name;
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Templates & import"
        description="Fast ways to fill a new plant: the standard STP set-up, a copy of a plant you already run, or years of history from Excel."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <PanelCard className="flex flex-col">
          <span className="bg-brand-50 text-brand-500 grid size-11 place-items-center rounded-2xl">
            <LayoutTemplate className="size-5" />
          </span>
          <h3 className="text-ink-900 mt-4 text-base font-semibold">STP template</h3>
          <p className="text-ink-500 mt-1 flex-1 text-sm">
            18 standard parameters (inflow, power, BGE, DG, lab), 11 constants, 5 chemicals, 3 staff categories, 3
            safety items and site cash, with typical standards. Only for a plant without parameters.
          </p>
          <Button
            className="mt-5"
            variant="secondary"
            disabled={!canEdit || paramCount > 0}
            onClick={() => setAsk('template')}
          >
            {paramCount > 0 ? `Already set up (${paramCount} parameters)` : 'Apply template'}
          </Button>
        </PanelCard>
        <PanelCard className="flex flex-col">
          <span className="grid size-11 place-items-center rounded-2xl bg-purple-50 text-purple-500">
            <Copy className="size-5" />
          </span>
          <h3 className="text-ink-900 mt-4 text-base font-semibold">Copy from another plant</h3>
          <p className="text-ink-500 mt-1 text-sm">
            Parameters, standards, constants, items and report labels. Not copied: history, opening balances and
            contract fees.
          </p>
          <div className="mt-4 flex-1">
            <Select
              value={source}
              onValueChange={setSource}
              placeholder={others.length ? 'Choose a plant…' : 'No other plants'}
              disabled={!canEdit || !others.length}
              options={others.map((p) => ({ value: p.id, label: p.name, hint: p.code }))}
            />
          </div>
          <Button className="mt-5" variant="secondary" disabled={!canEdit || !source} onClick={() => setAsk('copy')}>
            Copy settings
          </Button>
        </PanelCard>
        <PanelCard className="flex flex-col">
          <span className="bg-success-50 text-success-600 grid size-11 place-items-center rounded-2xl">
            <FileSpreadsheet className="size-5" />
          </span>
          <h3 className="text-ink-900 mt-4 text-base font-semibold">Import from Excel</h3>
          <p className="text-ink-500 mt-1 flex-1 text-sm">
            Bring past logsheets in from the old MIS workbook (DATA ENTRY sheet) or the OMMIS template. Available once
            the plant is live.
          </p>
          <Button className="mt-5" variant="secondary" asChild disabled={!can('imports.manage')}>
            <Link href={`/plants/${plant.id}/imports`}>Open the import</Link>
          </Button>
        </PanelCard>
      </div>
      <Modal
        open={!!ask}
        onOpenChange={(o) => !busy && !o && setAsk(null)}
        tone="warning"
        icon={<TriangleAlert />}
        title={ask === 'template' ? 'Apply the STP template?' : `Copy the settings of ${sourceName ?? 'that plant'}?`}
        description={
          ask === 'template'
            ? 'Fills this empty plant with the standard STP set-up. Standards and strengths start from the MIS start date; you can change any of them afterwards.'
            : 'This REPLACES the parameters, constants, stock, staff and safety items of this plant. Only possible before any logsheet exists.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(null)}>
              Cancel
            </Button>
            <Button variant={ask === 'copy' ? 'danger' : 'primary'} onClick={run} loading={busy}>
              {ask === 'template' ? 'Apply template' : 'Replace and copy'}
            </Button>
          </>
        }
      >
        {ask === 'copy' && (
          <Field label="Source plant">
            <Select
              value={source}
              onValueChange={setSource}
              options={others.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
        )}
      </Modal>
    </div>
  );
}
