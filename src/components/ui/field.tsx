'use client';

import { AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useContext, useId, type LabelHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-ink-700 mb-1.5 block text-[13px] font-medium', className)} {...props} />;
}

/** The id of the control inside the nearest <Field>, so its <label> is linked without passing ids by hand. */
const FieldIdContext = createContext<string | undefined>(undefined);
/** Controls call this: their own id wins, else the surrounding Field's id. */
export function useFieldId(own?: string): string | undefined {
  const ctx = useContext(FieldIdContext);
  return own ?? ctx;
}

/** Label + control + hint/error, with the error sliding in. Use with React Hook Form. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  labelRight,
}: {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  labelRight?: ReactNode;
}) {
  const auto = useId();
  const id = htmlFor ?? auto;
  return (
    <div className={cn('min-w-0', className)}>
      {(label || labelRight) && (
        <div className="flex items-baseline justify-between gap-2">
          {label && (
            <Label htmlFor={id}>
              {label}
              {required && <span className="text-danger-500 ml-0.5">*</span>}
            </Label>
          )}
          {labelRight}
        </div>
      )}
      <FieldIdContext.Provider value={id}>{children}</FieldIdContext.Provider>
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="e"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-danger-600 mt-1.5 flex items-center gap-1 text-xs font-medium"
            role="alert"
          >
            <AlertCircle className="size-3.5" />
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-ink-500 mt-1.5 text-xs">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Form-level error box (wrong password, network error, …). */
export function FormError({ message }: { message?: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div
            role="alert"
            className="rounded-control border-danger-100 bg-danger-50 text-danger-600 flex items-start gap-2 border px-3.5 py-2.5 text-[13px] font-medium"
          >
            <AlertCircle className="mt-px size-4 shrink-0" />
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
