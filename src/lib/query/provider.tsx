'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { isApiError } from '@/lib/api/errors';

/** 4xx errors are final (validation, permission, not found) — retrying only hides bugs and wastes rate limit. */
function retry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000, // TRD §8.11: lists 30 s (pages override: settings 5 min, MIS/dashboard 60 s)
        gcTime: 5 * 60_000,
        retry,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false }, // never auto-retry writes (money, logsheets)
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
