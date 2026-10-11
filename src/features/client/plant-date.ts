'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { isValidISODate, todayIST } from '@/lib/dates';
import { usePlant } from './plant-context';

/**
 * The date of a plant view lives in the URL: /plants/:id/dashboard/2026-09-21 (TRD §8.2).
 * No date = "latest date with data" (the API decides). Moving between Logsheet ↔ MIS ↔ Dashboard keeps it.
 */
export function usePlantDate(section: 'dashboard' | 'mis' | 'logsheet') {
  const { plant } = usePlant();
  const params = useParams<{ date?: string[] }>();
  const router = useRouter();
  const raw = params.date?.[0] ?? null;
  if (raw !== null && (!isValidISODate(raw) || (params.date?.length ?? 0) > 1)) notFound();
  const today = todayIST();
  const max = plant.omEnd < today ? plant.omEnd : today;
  const setDate = useCallback(
    (d: string) => router.push(`/plants/${plant.id}/${section}/${d}`, { scroll: false }),
    [plant.id, router, section],
  );
  const hrefFor = useCallback(
    (s: 'dashboard' | 'mis' | 'logsheet', d: string | null) => `/plants/${plant.id}/${s}${d ? `/${d}` : ''}`,
    [plant.id],
  );
  return { date: raw, setDate, hrefFor, min: plant.misStart, max };
}
