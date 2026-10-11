'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** DESIGN-SPEC §4: every button is a pill, ~40px tall, 14px/500 text, 18px icons. */
export const buttonVariants = cva(
  'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[background,box-shadow,color,transform,border-color] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15 [&_svg]:size-[18px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-primary-btn text-white shadow-[0_6px_16px_rgb(43_97_249/0.28)] hover:brightness-[1.06] hover:shadow-[0_8px_20px_rgb(43_97_249/0.34)]',
        secondary: 'border border-line bg-surface text-ink-900 hover:border-ink-300 hover:bg-canvas',
        soft: 'bg-brand-50 text-brand-500 hover:bg-brand-100',
        ghost: 'text-ink-700 hover:bg-muted-bg hover:text-ink-900',
        muted: 'bg-muted-bg text-ink-700 hover:bg-line',
        danger: 'bg-danger-500 text-white shadow-[0_6px_16px_rgb(229_69_111/0.25)] hover:bg-danger-600',
        'danger-soft': 'bg-danger-50 text-danger-600 hover:bg-danger-100',
        white: 'bg-white text-brand-500 hover:bg-brand-50',
        link: 'h-auto rounded-none px-0 text-brand-500 underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-7 px-3 text-xs [&_svg]:size-3.5',
        sm: 'h-8 px-3.5 text-[13px] [&_svg]:size-4',
        md: 'h-10 px-5',
        lg: 'h-11 px-6',
        icon: 'size-10 p-0',
        'icon-sm': 'size-8 p-0 [&_svg]:size-4',
      },
      block: { true: 'w-full' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, disabled, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  );
});

/** 40px circular white button with a 1px border (topbar bell/help, card ✕, chart menu). */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { size?: 'sm' | 'md' }
>(function IconButton({ className, size = 'md', type, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'border-line bg-surface text-ink-700 hover:border-ink-300 hover:bg-canvas hover:text-ink-900 focus-visible:ring-brand-500/15 inline-flex shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:ring-4 focus-visible:outline-none disabled:opacity-50',
        size === 'md' ? 'size-10 [&_svg]:size-[18px]' : 'size-8 [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
});
