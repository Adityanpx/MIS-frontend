'use client';

import { CalendarDays, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldId } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dateToISO, isoToDate, todayIST } from '@/lib/dates';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Calendar } from './calendar';

/**
 * A single business date ('YYYY-MM-DD', IST) in a pill that looks like an input.
 * Used by every "effective from" field, stock adjustments, registers and import openings.
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = 'Pick a date',
  invalid,
  disabled,
  clearable,
  id,
  className,
}: {
  value: string | null | undefined;
  onChange: (d: string | null) => void;
  min?: string | null;
  max?: string | null;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const fid = useFieldId(id);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn('relative', className)}>
        <PopoverTrigger asChild>
          <button
            id={fid}
            type="button"
            disabled={disabled}
            data-invalid={invalid || undefined}
            className={cn(
              'border-line bg-canvas text-ink-900 hover:border-ink-300 data-[state=open]:border-brand-500 data-[state=open]:bg-surface data-[state=open]:ring-brand-500/12 flex h-11 w-full items-center gap-2.5 rounded-full border px-4 text-left text-sm transition-[border-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-60 data-[state=open]:ring-4',
              'data-[invalid=true]:border-danger-500',
            )}
          >
            <CalendarDays className="text-ink-400 size-[18px] shrink-0" />
            <span className={cn('tabular flex-1 truncate', !value && 'text-ink-400')}>
              {value ? fmtDate(value) : placeholder}
            </span>
          </button>
        </PopoverTrigger>
        {clearable && value && !disabled && (
          <button
            type="button"
            aria-label="Clear date"
            onClick={() => onChange(null)}
            className="text-ink-400 hover:bg-muted-bg hover:text-ink-700 absolute top-1/2 right-2.5 grid size-7 -translate-y-1/2 place-items-center rounded-full"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-auto p-3">
        <Calendar
          mode="single"
          selected={value ? isoToDate(value) : undefined}
          defaultMonth={isoToDate(value ?? (max && max < todayIST() ? max : todayIST()))}
          onSelect={(d) => {
            if (!d) return;
            onChange(dateToISO(d));
            setOpen(false);
          }}
          disabled={[...(min ? [{ before: isoToDate(min) }] : []), ...(max ? [{ after: isoToDate(max) }] : [])]}
        />
      </PopoverContent>
    </Popover>
  );
}
