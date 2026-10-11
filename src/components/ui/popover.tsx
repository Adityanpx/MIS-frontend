'use client';

import * as P from '@radix-ui/react-popover';
import * as T from '@radix-ui/react-tooltip';
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export const PopoverAnchor = P.Anchor;

export const PopoverContent = forwardRef<ComponentRef<typeof P.Content>, ComponentPropsWithoutRef<typeof P.Content>>(
  function PopoverContent({ className, align = 'start', sideOffset = 8, ...props }, ref) {
    return (
      <P.Portal>
        <P.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'ommis-pop border-line bg-surface shadow-float z-50 rounded-2xl border p-3 focus:outline-none',
            className,
          )}
          {...props}
        />
      </P.Portal>
    );
  },
);

export const TooltipProvider = T.Provider;

/** Dark, small tooltip. Wrap the app once in <TooltipProvider delayDuration={150}>. */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}) {
  if (!content) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          align={align}
          sideOffset={6}
          className="ommis-pop bg-ink-900 shadow-float z-[60] max-w-xs rounded-lg px-2.5 py-1.5 text-xs font-medium text-white"
        >
          {content}
          <T.Arrow className="fill-ink-900" width={10} height={5} />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
