'use client';

import * as DM from '@radix-ui/react-dropdown-menu';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;

export const DropdownMenuContent = forwardRef<
  ComponentRef<typeof DM.Content>,
  ComponentPropsWithoutRef<typeof DM.Content>
>(function DropdownMenuContent({ className, sideOffset = 8, ...props }, ref) {
  return (
    <DM.Portal>
      <DM.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'ommis-pop border-line bg-surface shadow-float z-50 min-w-[200px] overflow-hidden rounded-2xl border p-1.5',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  ComponentRef<typeof DM.Item>,
  ComponentPropsWithoutRef<typeof DM.Item> & { danger?: boolean }
>(function DropdownMenuItem({ className, danger, ...props }, ref) {
  return (
    <DM.Item
      ref={ref}
      className={cn(
        'text-ink-700 data-[highlighted]:bg-canvas data-[highlighted]:text-ink-900 [&_svg]:text-ink-500 flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm font-medium transition-colors outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4',
        danger &&
          'text-danger-600 data-[highlighted]:bg-danger-50 data-[highlighted]:text-danger-600 [&_svg]:text-danger-500',
        className,
      )}
      {...props}
    />
  );
});

export const DropdownMenuCheckboxItem = forwardRef<
  ComponentRef<typeof DM.CheckboxItem>,
  ComponentPropsWithoutRef<typeof DM.CheckboxItem>
>(function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
  return (
    <DM.CheckboxItem
      ref={ref}
      className={cn(
        'text-ink-700 data-[highlighted]:bg-canvas relative flex h-9 cursor-pointer items-center rounded-xl pr-2.5 pl-8 text-sm font-medium outline-none select-none',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 grid size-4 place-items-center">
        <DM.ItemIndicator>
          <Check className="text-brand-500 size-4" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.CheckboxItem>
  );
});

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof DM.Label>) {
  return (
    <DM.Label
      className={cn('text-ink-400 px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wider uppercase', className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof DM.Separator>) {
  return <DM.Separator className={cn('bg-line my-1.5 h-px', className)} {...props} />;
}
