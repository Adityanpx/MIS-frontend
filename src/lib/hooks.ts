'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { clientApi } from '@/lib/api';
import { qk } from '@/lib/query/keys';

/** Shortcuts. `combo` like 'mod+k', 'alt+arrowleft', 'escape', '/'. Ignores typing inside inputs unless mod is used. */
export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const needMod = parts.includes('mod');
    const needAlt = parts.includes('alt');
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (needMod !== mod || needAlt !== e.altKey || e.key.toLowerCase() !== key) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      if (typing && !needMod) return;
      e.preventDefault();
      handler(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [combo, handler, enabled]);
}

/** true on screens ≥ the given min-width (px). Server render = false. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/** Avoids hydration mismatches for values only known in the browser. */
export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** "⌘" on Mac, "Ctrl" elsewhere. */
export function useModKey(): string {
  const mounted = useMounted();
  if (!mounted) return '⌘';
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
}

export interface PublicPlatform {
  name: string;
  logoUrl: string | null;
  supportEmail: string;
  supportPhone: string;
  terms: { version: string; termsUrl: string; privacyUrl: string };
}

/** GET /api/v1/public/platform — name, logo, support contact, Terms links (no sign-in needed). */
export function usePublicPlatform() {
  return useQuery({
    queryKey: qk.publicPlatform,
    queryFn: () => clientApi.get<PublicPlatform>('/public/platform', { skipAuth: true }),
    staleTime: 10 * 60_000,
  });
}
