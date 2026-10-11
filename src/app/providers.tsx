'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/popover';
import { Toaster } from '@/components/ui/toaster';
import { QueryProvider } from '@/lib/query/provider';

/** App-wide providers. The auth providers are NOT here: each area mounts its own (client vs admin). */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <QueryProvider>
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryProvider>
    </MotionConfig>
  );
}
