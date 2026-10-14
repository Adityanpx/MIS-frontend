'use client';

import { useMutation } from '@tanstack/react-query';
import { clientApi } from '@/lib/api';
import { usePortfolio, type PortfolioResponse } from '../engine-queries';

export { usePortfolio };
export type { PortfolioResponse };

export function usePortfolioExport() {
  return useMutation({
    mutationFn: ({ date, standard }: { date: string; standard: string }) =>
      clientApi.download('/company/portfolio.xlsx', {
        method: 'GET',
        fallbackName: `Portfolio-${date}.xlsx`,
        query: { date, standard },
      }),
  });
}
