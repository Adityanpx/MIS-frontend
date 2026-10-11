'use client';

import { Eye, EyeOff, Search } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useFieldId } from './field';

/** Pill input (DESIGN-SPEC: inputs are rounded-full, bg #F6F7F9, 1px border; focus = 2px brand ring). */
export const inputClass =
  'h-11 w-full rounded-full border border-line bg-canvas px-4 text-sm text-ink-900 transition-[border-color,box-shadow,background] duration-150 placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand-500/12 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger-500 aria-[invalid=true]:focus:ring-danger-500/12';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, invalid, id, ...props },
  ref,
) {
  const fid = useFieldId(id);
  if (!leading && !trailing) {
    return (
      <input ref={ref} id={fid} aria-invalid={invalid || undefined} className={cn(inputClass, className)} {...props} />
    );
  }
  return (
    <div className="relative">
      {leading && (
        <span className="text-ink-400 pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 [&_svg]:size-[18px]">
          {leading}
        </span>
      )}
      <input
        ref={ref}
        id={fid}
        aria-invalid={invalid || undefined}
        className={cn(inputClass, leading && 'pl-11', trailing && 'pr-11', className)}
        {...props}
      />
      {trailing && (
        <span className="text-ink-400 absolute top-1/2 right-3 -translate-y-1/2 [&_svg]:size-[18px]">{trailing}</span>
      )}
    </div>
  );
});

export const SearchInput = forwardRef<HTMLInputElement, InputProps>(function SearchInput(props, ref) {
  return <Input ref={ref} type="search" leading={<Search />} placeholder="Search…" {...props} />;
});

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <Input
      ref={ref}
      type={show ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="text-ink-400 hover:bg-muted-bg hover:text-ink-900 grid size-7 place-items-center rounded-full"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
});

/** PRD AUTH-03: ≥ 10 characters with a letter and a number. Shows a 4-step strength bar. */
export function PasswordStrength({ value }: { value: string }) {
  const checks = [
    value.length >= 10,
    /[A-Za-z]/.test(value) && /\d/.test(value),
    /[A-Z]/.test(value) && /[a-z]/.test(value),
    /[^A-Za-z0-9]/.test(value) || value.length >= 14,
  ];
  const score = checks.filter(Boolean).length;
  const colours = ['bg-danger-500', 'bg-warning-500', 'bg-yellow-500', 'bg-success-500'];
  const labels = ['Too weak', 'Weak', 'Good', 'Strong'];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'bg-muted-bg h-1.5 flex-1 rounded-full transition-colors duration-300',
              i < score && colours[score - 1],
            )}
          />
        ))}
      </div>
      <p className="text-ink-500 mt-1.5 text-xs">
        {value ? labels[Math.max(0, score - 1)] : 'At least 10 characters, with a letter and a number.'}
      </p>
    </div>
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, id, ...props }, ref) {
  const fid = useFieldId(id);
  return (
    <textarea
      ref={ref}
      id={fid}
      aria-invalid={invalid || undefined}
      className={cn(
        'rounded-control border-line bg-canvas text-ink-900 placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:bg-surface focus:ring-brand-500/12 aria-[invalid=true]:border-danger-500 min-h-24 w-full border px-4 py-3 text-sm transition-[border-color,box-shadow] focus:ring-4 focus:outline-none',
        className,
      )}
      {...props}
    />
  );
});
