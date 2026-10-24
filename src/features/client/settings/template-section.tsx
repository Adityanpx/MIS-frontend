'use client';

import { useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, LayoutTemplate, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/dialog';
import { clientApi } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import { usePlant } from '../plant-context';
import { PanelCard, SectionHeader, useCanEditSettings } from './parts';
import { apiErrors, useSettings } from './queries';
import type { ParameterDto } from './types';

/** §11.13 Start from the standard STP set-up (TPL-01), plus the import entry. */
export function TemplateSection() {
  const { plant, can } = usePlant();
  const canEdit = useCanEditSettings();
  const qc = useQueryClient();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const paramCount = useSettings('parameters').data?.length ?? 0;

  async function run() {
    setBusy(true);
    try {
      const list = await clientApi.post<ParameterDto[]>(`/plants/${plant.id}/settings/apply-template`);
      qc.setQueryData(qk.client.settings(plant.id, 'parameters'), list);
      void qc.invalidateQueries({ queryKey: qk.client.plant(plant.id) });
      toast.success('STP template applied', {
        description: 'Review the parameters, standards and opening balances, then complete the checklist.',
      });
      setAsk(false);
    } catch (e) {
      apiErrors(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Templates & import"
        description="Fast ways to fill a new plant: the standard STP set-up, or years of history from Excel."
      />
      <div className="grid gap-6 lg:grid-cols-2">
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
            onClick={() => setAsk(true)}
          >
            {paramCount > 0 ? `Already set up (${paramCount} parameters)` : 'Apply template'}
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
        open={ask}
        onOpenChange={(o) => !busy && !o && setAsk(false)}
        tone="warning"
        icon={<TriangleAlert />}
        title="Apply the STP template?"
        description="Fills this empty plant with the standard STP set-up. Standards and strengths start from the MIS start date; you can change any of them afterwards."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsk(false)}>
              Cancel
            </Button>
            <Button onClick={run} loading={busy}>
              Apply template
            </Button>
          </>
        }
      />
    </div>
  );
}
