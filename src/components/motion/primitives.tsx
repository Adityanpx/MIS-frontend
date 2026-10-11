'use client';

/**
 * Animation vocabulary of the whole app (keep it small and consistent):
 *  - FadeUp        : a block enters 12px below and fades in (cards, headers)
 *  - Stagger/Item  : children enter one after another (card grids, table rows, list items)
 *  - HoverLift     : cards rise 2px with a soft shadow on hover
 *  - Collapse      : height-auto open/close (sidebar groups, accordions)
 *  - PageFade      : route content cross-fade
 * All respect "reduce motion" (Framer's MotionConfig reducedMotion="user" in Providers).
 */
import { AnimatePresence, motion, type HTMLMotionProps, type Variants } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const;
export const SPRING_SOFT = { type: 'spring', stiffness: 220, damping: 28 } as const;

export function FadeUp({
  delay = 0,
  y = 12,
  className,
  children,
  ...rest
}: HTMLMotionProps<'div'> & { delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const containerVariants = (stagger: number, delay: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};

export function Stagger({
  stagger = 0.06,
  delay = 0,
  className,
  children,
  ...rest
}: HTMLMotionProps<'div'> & { stagger?: number; delay?: number }) {
  return (
    <motion.div
      variants={containerVariants(stagger, delay)}
      initial="hidden"
      animate="show"
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ className, children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={itemVariants} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

export function HoverLift({ className, children, disabled, ...rest }: HTMLMotionProps<'div'> & { disabled?: boolean }) {
  return (
    <motion.div
      whileHover={disabled ? undefined : { y: -2, boxShadow: '0 12px 32px rgb(16 24 40 / 0.08)' }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className={cn('rounded-card', className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="c"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PageFade({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
