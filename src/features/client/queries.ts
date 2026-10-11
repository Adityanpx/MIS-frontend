'use client';

import { useQuery } from '@tanstack/react-query';
import { clientApi } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { qk } from '@/lib/query/keys';
import type { BillingSummary, LifecycleBannerDto, PlantDetail, PlantSummary } from './api-types';

/** Every client data hook is enabled only while signed in, so nothing fires before the token exists. */
const useSignedIn = () => useClientAuth().status === 'authenticated';

export function useBanners() {
  return useQuery({
    queryKey: qk.client.banners,
    queryFn: () => clientApi.get<LifecycleBannerDto[]>('/banners'),
    enabled: useSignedIn(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function usePlants() {
  return useQuery({
    queryKey: qk.client.plants,
    queryFn: () => clientApi.get<PlantSummary[]>('/plants'),
    enabled: useSignedIn(),
  });
}

export function usePlantDetail(plantId: string | undefined) {
  return useQuery({
    queryKey: qk.client.plant(plantId ?? ''),
    queryFn: () => clientApi.get<PlantDetail>(`/plants/${plantId}`),
    enabled: useSignedIn() && !!plantId,
    staleTime: 60_000,
  });
}

export function useBillingSummary(enabled = true) {
  return useQuery({
    queryKey: qk.client.billingSummary,
    queryFn: () => clientApi.get<BillingSummary>('/billing/summary'),
    enabled: useSignedIn() && enabled,
    staleTime: 5 * 60_000,
  });
}
