'use client';

import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useMediaQuery } from '@/lib/hooks';
import { cn } from '@/lib/utils';

/**
 * Right-side drawer exactly like the video's "Add Widget": the page dims and blurs,
 * a white panel slides in with rounded-3xl left corners, header title + circular ✕.
 * On phones it becomes a bottom sheet.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const widths = { sm: 'sm:w-[400px]', md: 'sm:w-[520px]', lg: 'sm:w-[680px]', xl: 'sm:w-[880px]' } as const;
  const side = useMediaQuery('(min-width: 640px)');
  const hidden = side ? { x: '104%', opacity: 0.6 } : { y: '100%', opacity: 0.6 };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="bg-ink-900/20 fixed inset-0 z-50 backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </D.Overlay>
            <D.Content asChild forceMount>
              <motion.div
                className={cn(
                  'bg-surface shadow-float fixed z-50 flex flex-col focus:outline-none',
                  'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl',
                  'sm:border-line sm:inset-y-3 sm:right-3 sm:left-auto sm:max-h-none sm:rounded-3xl sm:border',
                  widths[width],
                )}
                initial={hidden}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={hidden}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              >
                <div className="border-line flex items-start justify-between gap-4 border-b px-6 py-5">
                  <div className="min-w-0">
                    <D.Title className="text-ink-900 text-xl font-semibold tracking-tight">{title}</D.Title>
                    {description ? (
                      <D.Description className="text-ink-500 mt-1 text-sm">{description}</D.Description>
                    ) : (
                      <D.Description className="sr-only">{typeof title === 'string' ? title : 'Panel'}</D.Description>
                    )}
                  </div>
                  <D.Close
                    className="border-line text-ink-700 hover:bg-canvas hover:text-ink-900 grid size-9 shrink-0 place-items-center rounded-full border transition-colors"
                    aria-label="Close"
                  >
                    <X className="size-4" />
                  </D.Close>
                </div>
                <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
                {footer && <div className="border-line flex justify-end gap-2 border-t px-6 py-4">{footer}</div>}
              </motion.div>
            </D.Content>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
