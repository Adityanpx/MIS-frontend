'use client';

import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EASE_OUT } from '@/components/motion/primitives';

/**
 * Centered modal: dim + blur backdrop, card scales in. Used for confirmations, reason dialogs, small forms.
 * Controlled only (`open` / `onOpenChange`) so AnimatePresence can play the exit animation.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  icon,
  tone = 'brand',
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  tone?: 'brand' | 'danger' | 'warning' | 'success';
  dismissible?: boolean;
}) {
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;
  const wells = {
    brand: 'bg-brand-50 text-brand-500',
    danger: 'bg-danger-50 text-danger-500',
    warning: 'bg-warning-50 text-warning-500',
    success: 'bg-success-50 text-success-600',
  } as const;
  return (
    <D.Root open={open} onOpenChange={(o) => (dismissible || o ? onOpenChange(o) : undefined)}>
      <AnimatePresence>
        {open && (
          <D.Portal forceMount>
            <D.Overlay asChild forceMount>
              <motion.div
                className="bg-ink-900/25 fixed inset-0 z-50 backdrop-blur-[6px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </D.Overlay>
            <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
              <D.Content asChild forceMount onPointerDownOutside={(e) => !dismissible && e.preventDefault()}>
                <motion.div
                  className={cn(
                    'border-line bg-surface shadow-float relative w-full rounded-3xl border p-6 focus:outline-none',
                    widths[size],
                  )}
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                >
                  <div className="flex items-start gap-4 pr-8">
                    {icon && (
                      <span
                        className={cn(
                          'grid size-11 shrink-0 place-items-center rounded-2xl [&_svg]:size-5',
                          wells[tone],
                        )}
                      >
                        {icon}
                      </span>
                    )}
                    <div className="min-w-0">
                      <D.Title className="text-ink-900 text-lg font-semibold tracking-tight">{title}</D.Title>
                      {description ? (
                        <D.Description className="text-ink-500 mt-1 text-sm">{description}</D.Description>
                      ) : (
                        <D.Description className="sr-only">
                          {typeof title === 'string' ? title : 'Dialog'}
                        </D.Description>
                      )}
                    </div>
                  </div>
                  {dismissible && (
                    <D.Close
                      className="border-line text-ink-500 hover:bg-canvas hover:text-ink-900 absolute top-4 right-4 grid size-9 place-items-center rounded-full border transition-colors"
                      aria-label="Close"
                    >
                      <X className="size-4" />
                    </D.Close>
                  )}
                  {children && <div className="mt-5">{children}</div>}
                  {footer && (
                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
                  )}
                </motion.div>
              </D.Content>
            </div>
          </D.Portal>
        )}
      </AnimatePresence>
    </D.Root>
  );
}
