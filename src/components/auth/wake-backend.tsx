'use client';

import { wakeBackend } from '@/lib/wake';
import { useEffect } from 'react';

/** Starts the backend wake-up on mount of any public (auth) page. Renders nothing. */
export function WakeBackend() {
  useEffect(() => {
    void wakeBackend();
  }, []);
  return null;
}
