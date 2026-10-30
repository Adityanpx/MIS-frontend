'use client';

/**
 * Backend wake-up.
 *
 * Render's free tier sleeps a service after about 15 minutes of inactivity. The first request after that
 * takes 30–60 seconds to answer, so a login that fires straight away gets a 502 and (if it keeps retrying)
 * trips the 10/min login rate limit.
 *
 * This module pings /health on page load and keeps polling it until it answers. A single Promise is shared
 * across the app, so every page and every component sees "ready" at the same moment. Pages that need the
 * backend (login forms, data pages after sign-in) await `wakeBackend()` before firing their first request,
 * so the user sees a quiet "server starting" state instead of a scary error.
 */
import { useEffect, useState } from 'react';

let ready: Promise<void> | null = null;
let done = false;

export function isBackendReady(): boolean {
  return done;
}

/** Returns a promise that resolves when the backend answers /health. Repeated calls share the same wake. */
export function wakeBackend(): Promise<void> {
  if (ready) return ready;
  ready = new Promise<void>((resolve) => {
    let delay = 3000;
    const tryOnce = async () => {
      try {
        const r = await fetch('/health', { cache: 'no-store' });
        if (r.ok) {
          done = true;
          return resolve();
        }
      } catch {
        /* network error during cold start — try again */
      }
      setTimeout(tryOnce, delay);
      delay = Math.min(delay + 1000, 8000); // ease off so we don't hammer the host
    };
    tryOnce();
  });
  return ready;
}

/** React hook: starts the wake on mount, re-renders when the backend answers. */
export function useBackendReady(): boolean {
  const [state, setState] = useState<boolean>(() => done);
  useEffect(() => {
    if (done) return;
    let cancelled = false;
    void wakeBackend().then(() => {
      if (!cancelled) setState(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
