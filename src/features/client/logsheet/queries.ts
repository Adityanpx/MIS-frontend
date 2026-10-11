'use client';

import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { clientApi } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { qk } from '@/lib/query/keys';
import type {
  CorrectionRequest,
  CorrectResult,
  DraftResult,
  HistoryRow,
  LogCalendar,
  LogsheetForm,
  SubmitResult,
  ValueItem,
} from './types';

const useSignedIn = () => useClientAuth().status === 'authenticated';
const base = (plantId: string) => `/plants/${plantId}/logsheets`;

export function useLogCalendar(plantId: string, month: string) {
  return useQuery({
    queryKey: qk.client.logCalendar(plantId, month),
    queryFn: () => clientApi.get<LogCalendar>(`${base(plantId)}/calendar`, { query: { month } }),
    enabled: useSignedIn(),
    staleTime: 30_000,
  });
}

/** The form is re-read only on purpose (reload button / after submit) so a background refetch never wipes typing. */
export function useLogForm(plantId: string, date: string) {
  return useQuery({
    queryKey: qk.client.logForm(plantId, date),
    queryFn: () => clientApi.get<LogsheetForm>(`${base(plantId)}/${date}/form`),
    enabled: useSignedIn(),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useLogHistory(plantId: string, date: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.client.logHistory(plantId, date),
    queryFn: () => clientApi.get<HistoryRow[]>(`${base(plantId)}/${date}/history`),
    enabled: useSignedIn() && enabled,
  });
}

export function useCorrectionRequests(plantId: string, status: 'pending' | 'approved' | 'rejected') {
  return useQuery({
    queryKey: qk.client.corrections(plantId, status),
    queryFn: () => clientApi.get<CorrectionRequest[]>(`${base(plantId)}/correction-requests`, { query: { status } }),
    enabled: useSignedIn(),
    staleTime: 15_000,
  });
}

/** Every logsheet write goes through here (the form keeps its own state; these are plain calls). */
export const logApi = {
  lock: (plantId: string, date: string) => clientApi.post<{ lockedUntil: string }>(`${base(plantId)}/${date}/lock`),
  unlock: (plantId: string, date: string) => clientApi.del(`${base(plantId)}/${date}/lock`),
  saveDraft: (plantId: string, date: string, values: ValueItem[], version: number) =>
    clientApi.put<DraftResult>(`${base(plantId)}/${date}`, { values, version }),
  submit: (plantId: string, date: string, values: ValueItem[], version: number, remarks?: string) =>
    clientApi.post<SubmitResult>(`${base(plantId)}/${date}/submit`, { values, version, remarks: remarks || undefined }),
  correct: (plantId: string, date: string, values: ValueItem[], version: number, reason: string) =>
    clientApi.post<CorrectResult>(`${base(plantId)}/${date}/correct`, { values, version, reason }),
  requestCorrection: (plantId: string, date: string, values: ValueItem[], reason: string) =>
    clientApi.post<{ id: string; status: 'pending' }>(`${base(plantId)}/${date}/correction-requests`, {
      values,
      reason,
    }),
  decide: (plantId: string, id: string, approve: boolean, comment?: string) =>
    clientApi.post(`${base(plantId)}/correction-requests/${id}/${approve ? 'approve' : 'reject'}`, {
      comment: comment || undefined,
    }),
};

/**
 * After a submit / correction / import the engine recalculates: drop every cached view of the plant
 * (dashboard, MIS, reports, calendar, forms) and the company overview (File 2 handoff).
 */
export function invalidatePlantData(qc: QueryClient, plantId: string) {
  void qc.invalidateQueries({ queryKey: qk.client.plant(plantId) });
  void qc.invalidateQueries({ queryKey: qk.client.overview });
}
export const useInvalidatePlantData = () => {
  const qc = useQueryClient();
  return (plantId: string) => invalidatePlantData(qc, plantId);
};
