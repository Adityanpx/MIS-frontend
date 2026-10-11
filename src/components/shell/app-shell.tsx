'use client';

import { AnimatePresence, motion } from 'motion/react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useHotkey } from '@/lib/hooks';
import { CommandPalette } from './command-palette';
import { Topbar } from './topbar';
import type { CommandItem } from './types';

export interface SidebarRenderArgs {
  collapsed: boolean;
  toggle?: () => void;
  onNavigate?: () => void;
}

/**
 * Layout of both signed-in areas (DESIGN-SPEC §3):
 *  ┌ sidebar 256px (white, 1px right border) ┬ topbar 72px (search ⌘K … help · bell · avatar) ┐
 *  │                                         ├ banners (lifecycle / act-as)                      │
 *  │                                         └ main: canvas #F6F7F9, padding 32px              ┘
 * Phones/tablets: the sidebar becomes a slide-in drawer with a blurred backdrop.
 */
export function AppShell({
  sidebar,
  topbarRight,
  topbarLeft,
  banners,
  commandItems,
  helpHref,
  children,
  storageKey,
}: {
  sidebar: (a: SidebarRenderArgs) => ReactNode;
  topbarRight: ReactNode;
  topbarLeft?: ReactNode;
  banners?: ReactNode;
  commandItems: CommandItem[];
  helpHref?: string;
  children: ReactNode;
  storageKey: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(storageKey) === '1');
    } catch {
      /* ignore */
    }
  }, [storageKey]);
  const toggle = useCallback(() => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(storageKey, c ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !c;
    });
  }, [storageKey]);

  useEffect(() => setMobileOpen(false), [pathname]);
  useHotkey(
    'mod+k',
    useCallback(() => setPaletteOpen((o) => !o), []),
  );

  return (
    <div className="bg-canvas flex min-h-dvh">
      {/* desktop sidebar */}
      <motion.aside
        className="no-print border-line bg-surface sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-r lg:block"
        animate={{ width: collapsed ? 84 : 256 }}
        initial={false}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        {sidebar({ collapsed, toggle })}
      </motion.aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="bg-ink-900/25 fixed inset-0 z-40 backdrop-blur-[6px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="border-line bg-surface shadow-float fixed inset-y-0 left-0 z-50 w-[280px] overflow-hidden rounded-r-3xl border-r lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            >
              {sidebar({ collapsed: false, onNavigate: () => setMobileOpen(false) })}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onMenu={() => setMobileOpen(true)}
          onSearch={() => setPaletteOpen(true)}
          left={topbarLeft}
          right={topbarRight}
          helpHref={helpHref}
        />
        <div className="no-print">{banners}</div>
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} items={commandItems} />
    </div>
  );
}
