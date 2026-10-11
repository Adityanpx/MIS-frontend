'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { qk } from '@/lib/query/keys';

/** GET /api/v1/exports/:id (Phase 2 §10.5) — logsheet Excel, PDF ZIP and full company exports. */
export interface ExportJob {
  id: string;
  scope: { type?: string; plantId?: string; from?: string; to?: string; plantIds?: string[] | null };
  status: 'queued' | 'building' | 'ready' | 'failed' | 'expired';
  expiresAt: string | null;
  error: string | null;
  createdAt: string;
}

/** queued (company export waiting for the worker) or building */
export const isRunning = (j: Pick<ExportJob, 'status'> | undefined) =>
  j?.status === 'queued' || j?.status === 'building';
/** ready and not past its 7-day expiry (the API answers 404 after that) */
export const isDownloadable = (j: Pick<ExportJob, 'status' | 'expiresAt'>) =>
  j.status === 'ready' && (!j.expiresAt || Date.parse(j.expiresAt) > Date.now());

export const downloadExport = async (id: string) => {
  try {
    await clientApi.download(`/exports/${id}/download`);
  } catch (e) {
    toast.error(errorMessage(e));
  }
};

/**
 * Polls one export every 2 s while it is queued / building. When it is ready a toast with a **Download**
 * button appears (a click is needed: browsers block a new tab that is not opened from a click).
 */
export function useExportJob(id: string | null, autoDownload = true) {
  const signedIn = useClientAuth().status === 'authenticated';
  const done = useRef<string | null>(null);
  const q = useQuery({
    queryKey: qk.client.exportJob(id ?? ''),
    queryFn: () => clientApi.get<ExportJob>(`/exports/${id}`),
    enabled: signedIn && !!id,
    refetchInterval: (query) => (isRunning(query.state.data) ? 2000 : false),
  });
  const status = q.data?.status;
  useEffect(() => {
    if (!id || done.current === id) return;
    if (status === 'ready') {
      done.current = id;
      if (autoDownload)
        toast.success('Your file is ready', {
          duration: 60_000,
          action: { label: 'Download', onClick: () => void downloadExport(id) },
        });
      else toast.success('Your file is ready');
    }
    if (status === 'failed') {
      done.current = id;
      toast.error('The export failed', { description: q.data?.error ?? 'Please try again.' });
    }
  }, [id, status, autoDownload, q.data?.error]);
  return q;
}
