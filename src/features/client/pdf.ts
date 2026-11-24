'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { clientApi, errorMessage } from '@/lib/api';
import type { PdfDoc } from './engine-types';

/**
 * Download the PDF of one date (MIS A4 / dashboard A3 / logsheet A4).
 * One request: the server returns the archived file, or builds it first when it is missing, so a click always ends in a
 * saved file. Building can take a few seconds, hence the progress toast.
 */
export function usePlantPdf(plantId: string, _canGenerate?: boolean) {
  const [busy, setBusy] = useState(false);

  /** `filter` (MIS page only): the Daily / Monthly / UTD and Actual / Bidding picked on screen; the PDF prints exactly that. */
  async function download(date: string, type: PdfDoc['doc_type'], filter?: { period: string; kind: string }) {
    setBusy(true);
    const wait = window.setTimeout(() => toast.message('Preparing your PDF…', { id: 'pdf-wait', duration: 20_000 }), 2500);
    try {
      await clientApi.download(`/plants/${plantId}/pdfs/file`, {
        query: { date, type, ...(filter ?? {}) },
        fallbackName: `${type}-${date}.pdf`,
      });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      window.clearTimeout(wait);
      toast.dismiss('pdf-wait');
      setBusy(false);
    }
  }
  return { download, busy };
}
