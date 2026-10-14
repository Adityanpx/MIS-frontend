'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientApi } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { qk } from '@/lib/query/keys';
import type { DashboardLayout, DashboardWidgetId } from '@/shared/schemas/dashboard';
import type {
  DashboardData,
  MaintenanceTabPayload,
  MisReport,
  Overview,
  PdfDoc,
  PortfolioRow,
  ReportTable,
  TrendRow,
} from './engine-types';

const useSignedIn = () => useClientAuth().status === 'authenticated';
const ENGINE_STALE = 60_000; // TRD §8.11: MIS / dashboard 1 minute

export function useOverview() {
  return useQuery({
    queryKey: qk.client.overview,
    queryFn: () => clientApi.get<Overview>('/overview'),
    enabled: useSignedIn(),
    staleTime: ENGINE_STALE,
    refetchOnWindowFocus: true,
  });
}

/** `date` null = the latest date with data (the API decides). */
export function useDashboard(plantId: string, date: string | null) {
  return useQuery({
    queryKey: qk.client.dashboard(plantId, date),
    queryFn: () => clientApi.get<DashboardData>(`/plants/${plantId}/dashboard`, { query: { date } }),
    enabled: useSignedIn(),
    staleTime: ENGINE_STALE,
    placeholderData: keepPreviousData,
  });
}

export function useMis(plantId: string, date: string | null) {
  return useQuery({
    queryKey: qk.client.mis(plantId, date),
    queryFn: () => clientApi.get<MisReport>(`/plants/${plantId}/mis`, { query: { date } }),
    enabled: useSignedIn(),
    staleTime: ENGINE_STALE,
    placeholderData: keepPreviousData,
  });
}

export function useTrend(plantId: string, param: string | null, from: string, to: string) {
  return useQuery({
    queryKey: qk.client.trend(plantId, param ?? '', from, to),
    queryFn: () =>
      clientApi.get<ReportTable<TrendRow>>(`/plants/${plantId}/reports/trend`, { query: { param, from, to } }),
    enabled: useSignedIn() && !!param && from <= to,
    staleTime: ENGINE_STALE,
    placeholderData: keepPreviousData,
  });
}

export interface LayoutResponse {
  layout: DashboardLayout | null;
  updatedAt: string | null;
  defaults: DashboardWidgetId[];
}

export function useDashboardLayout(plantId: string) {
  return useQuery({
    queryKey: qk.client.layout(plantId),
    queryFn: () => clientApi.get<LayoutResponse>(`/plants/${plantId}/dashboard/layout`),
    enabled: useSignedIn(),
    staleTime: Infinity,
  });
}

/** Saves the layout; the cache is updated first so the dashboard re-arranges instantly. */
export function useSaveLayout(plantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: DashboardLayout | null) =>
      layout
        ? clientApi.put<LayoutResponse>(`/plants/${plantId}/dashboard/layout`, { layout })
        : clientApi.del(`/plants/${plantId}/dashboard/layout`).then(() => null),
    onMutate: (layout) => {
      const prev = qc.getQueryData<LayoutResponse>(qk.client.layout(plantId));
      if (prev) qc.setQueryData<LayoutResponse>(qk.client.layout(plantId), { ...prev, layout });
    },
    onSuccess: (res) => {
      if (res) qc.setQueryData(qk.client.layout(plantId), res);
    },
  });
}

export function usePdfList(plantId: string, year: number, month: number, enabled = true) {
  return useQuery({
    queryKey: qk.client.pdfs(plantId, year, month),
    queryFn: () => clientApi.get<PdfDoc[]>(`/plants/${plantId}/pdfs`, { query: { year, month } }),
    enabled: useSignedIn() && enabled,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// v1.1 queries
// ---------------------------------------------------------------------------

export interface PortfolioResponse {
  reportDate: string;
  rows: PortfolioRow[];
  exceptions: Array<{ plantId: string; type: string; detail: string }>;
}

export function usePortfolio(
  date: string,
  standard: 'bidding' | 'actual' | 'primary' = 'primary',
) {
  return useQuery({
    queryKey: qk.client.portfolio(date, standard),
    queryFn: () =>
      clientApi.get<PortfolioResponse>('/company/portfolio', { query: { date, standard } }),
    enabled: useSignedIn() && !!date,
    staleTime: 30_000,
  });
}

export function useMaintenanceTab(plantId: string, date: string) {
  return useQuery({
    queryKey: qk.client.maintenanceTab(plantId, date),
    queryFn: () =>
      clientApi.get<MaintenanceTabPayload>(`/plants/${plantId}/maintenance`, { query: { date } }),
    enabled: useSignedIn() && !!date,
    staleTime: ENGINE_STALE,
  });
}
