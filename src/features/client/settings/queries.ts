'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ZodType } from 'zod';
import { clientApi, errorMessage, fieldErrors, isApiError } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { qk } from '@/lib/query/keys';
import { usePlant } from '../plant-context';
import type {
  BankGuarantee,
  CashSettings,
  ConstantRow,
  ContractYears,
  GeneralSettings,
  GoLiveCheck,
  InsurancePolicy,
  ParameterDto,
  SafetyDto,
  StaffDto,
  StockItemDto,
} from './types';

/** section id → API path + response type. One cache entry per section. */
export interface SettingsData {
  general: GeneralSettings;
  parameters: ParameterDto[];
  constants: ConstantRow[];
  'stock-items': StockItemDto[];
  staff: StaffDto[];
  safety: SafetyDto[];
  'contract-years': ContractYears;
  cash: CashSettings;
  'bank-guarantees': BankGuarantee[];
  insurance: InsurancePolicy[];
  'go-live-check': GoLiveCheck;
}
export type SettingsKey = keyof SettingsData;

export function useSettings<K extends SettingsKey>(key: K, enabled = true) {
  const { plant } = usePlant();
  const signedIn = useClientAuth().status === 'authenticated';
  return useQuery({
    queryKey: qk.client.settings(plant.id, key),
    queryFn: () => clientApi.get<SettingsData[K]>(`/plants/${plant.id}/settings/${key}`),
    enabled: signedIn && enabled,
    staleTime: 60_000,
  });
}

/**
 * Every settings write: call → put the returned section in the cache → refresh the go-live checklist,
 * the plant (setup status) and every engine view (settings changes recalculate reports, SET-* / CHG-*).
 * Most write endpoints return the whole updated section, so the screen updates without another GET.
 */
export function useSettingsWrite<B, K extends SettingsKey | null>(opts: {
  key: K;
  request: (plantId: string, body: B) => Promise<K extends SettingsKey ? SettingsData[K] : unknown>;
  success?: string | ((body: B) => string);
}) {
  const { plant } = usePlant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: B) => opts.request(plant.id, body),
    onSuccess: (data, body) => {
      if (opts.key && data !== undefined) qc.setQueryData(qk.client.settings(plant.id, opts.key), data);
      void qc.invalidateQueries({
        queryKey: qk.client.plant(plant.id),
        predicate: (q) => !(opts.key && q.queryKey[3] === 'settings' && q.queryKey[4] === opts.key),
      });
      void qc.invalidateQueries({ queryKey: qk.client.overview });
      const msg = typeof opts.success === 'function' ? opts.success(body) : opts.success;
      if (msg) toast.success(msg);
    },
  });
}

/** Validates a request body with the SAME zod schema the API uses; returns field messages by path. */
export function checkBody<T>(
  schema: ZodType<T>,
  body: unknown,
): { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(body);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const i of r.error.issues) {
    const k = i.path.join('.') || '_';
    if (!errors[k]) errors[k] = i.message;
  }
  return { ok: false, errors };
}

/** API error → field messages (+ a toast for anything that is not about one field). */
export function apiErrors(e: unknown): Record<string, string> {
  const f = fieldErrors(e);
  if (Object.keys(f).length === 0 || (isApiError(e) && e.code !== 'VALIDATION_FAILED' && !e.details?.field)) {
    toast.error(errorMessage(e));
  }
  return f;
}

export const settingsApi = {
  path: (plantId: string, p: string) => `/plants/${plantId}/settings/${p}`,
};
