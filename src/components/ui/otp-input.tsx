'use client';

import { motion } from 'motion/react';
import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

/**
 * 6 boxes for the authenticator code. Auto-advance, backspace goes back, paste fills all,
 * `onComplete` fires when the 6th digit is typed (the forms submit automatically).
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  invalid,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const set = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
      set(value.slice(0, i - 1));
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    set(text);
    refs.current[Math.min(text.length, length - 1)]?.focus();
  };

  return (
    <motion.div
      className="flex justify-between gap-2"
      animate={invalid ? { x: [0, -8, 8, -6, 6, -3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1}`}
          maxLength={1}
          onPaste={onPaste}
          onKeyDown={(e) => onKey(i, e)}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            if (!ch) return;
            const next = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, length);
            set(next);
            if (i < length - 1) refs.current[i + 1]?.focus();
          }}
          className={cn(
            'border-line bg-canvas text-ink-900 tabular focus:border-brand-500 focus:bg-surface focus:ring-brand-500/12 h-14 w-full max-w-14 min-w-0 rounded-2xl border text-center text-xl font-semibold transition-[border-color,box-shadow,background] focus:ring-4 focus:outline-none disabled:opacity-60',
            d && 'border-brand-200 bg-surface',
            invalid && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/12',
          )}
        />
      ))}
    </motion.div>
  );
}
