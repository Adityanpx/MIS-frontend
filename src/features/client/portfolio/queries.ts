'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clientApi, errorMessage } from '@/lib/api';
import { usePortfolio, type PortfolioResponse } from '../engine-queries';

export { usePortfolio };
export type { PortfolioResponse };

/** Excel export of the screen (sheet "Plants" + sheet "Issues"): same endpoint with format=xlsx. */
export function usePortfolioExport() {
  return useMutation({
    mutationFn: ({ date, standard }: { date: string; standard: string }) =>
      clientApi.download('/company/portfolio', {
        method: 'GET',
        fallbackName: `Portfolio-${date}.xlsx`,
        query: { date, standard, format: 'xlsx' },
      }),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
