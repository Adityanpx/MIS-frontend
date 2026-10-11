'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { clientApi, errorMessage } from '@/lib/api';
import { qk } from '@/lib/query/keys';
import type { PdfDoc } from './engine-types';

/**
 * Download the archived PDF (MIS A3 / dashboard A3 / logsheet A4) of one date.
 * Finds the newest current (or stale) version in GET /pdfs?year&month, then opens its signed URL.
 * When none exists, users allowed to generate (Editor / Client Admin) get a "Generate" action.
 */
export function usePlantPdf(plantId: string, canGenerate: boolean) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function generate(date: string) {
    try {
      await clientApi.post(`/plants/${plantId}/pdfs/generate`, { date });
      toast.success('PDFs are being generated', { description: 'They appear in the PDF archive in about a minute.' });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function download(date: string, type: PdfDoc['doc_type']) {
    setBusy(true);
    try {
      const [y, m] = date.split('-').map(Number);
      const docs = await qc.fetchQuery({
        queryKey: qk.client.pdfs(plantId, y ?? 0, m ?? 0),
        queryFn: () => clientApi.get<PdfDoc[]>(`/plants/${plantId}/pdfs`, { query: { year: y, month: m } }),
        staleTime: 15_000,
      });
      const doc = docs
        .filter(
          (d) =>
            d.date.slice(0, 10) === date && d.doc_type === type && (d.status === 'current' || d.status === 'stale'),
        )
        .sort((a, b) => b.version - a.version)[0];
      if (doc) {
        if (doc.status === 'stale')
          toast.message('This PDF is out of date', { description: 'A newer version is being prepared.' });
        await clientApi.download(`/plants/${plantId}/pdfs/${doc.id}/download`);
        return;
      }
      toast.message('No PDF for this date yet', {
        description: canGenerate
          ? 'Generate it now? It takes about a minute.'
          : 'It is created automatically after the logsheet is submitted.',
        action: canGenerate ? { label: 'Generate', onClick: () => void generate(date) } : undefined,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { download, generate, busy };
}
