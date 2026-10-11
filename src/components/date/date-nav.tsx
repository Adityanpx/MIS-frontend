'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { addDays, addMonths, dateToISO, isoToDate, todayIST } from '@/lib/dates';
import { fmtDate, fmtMonth } from '@/lib/format';
import { useHotkey } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Calendar } from './calendar';

const navBtn =
  'grid size-10 place-items-center rounded-full border border-line bg-surface text-ink-700 transition-colors hover:bg-canvas hover:text-ink-900 disabled:pointer-events-none disabled:opacity-35';

/**
 * ◀ 21-Sep-2026 ▶ — the Excel's single date spinner (TRD §8.2). Keeps one date across Logsheet ↔ MIS ↔ Dashboard.
 * Dates outside [min, max] are disabled. Keyboard: Alt+← / Alt+→ move one day.
 */
export function DateNav({
  value,
  onChange,
  min,
  max,
  className,
  isDisabled,
}: {
  value: string;
  onChange: (d: string) => void;
  min?: string | null;
  max?: string | null;
  className?: string;
  /** extra rule, e.g. logsheet dates that are not allowed */
  isDisabled?: (d: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const prev = addDays(value, -1);
  const next = addDays(value, 1);
  const canPrev = !min || prev >= min;
  const canNext = !max || next <= max;
  const go = (d: string) => onChange(d);
  useHotkey('alt+arrowleft', () => canPrev && go(prev));
  useHotkey('alt+arrowright', () => canNext && go(next));
  const today = todayIST();

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button type="button" className={navBtn} disabled={!canPrev} onClick={() => go(prev)} aria-label="Previous day">
        <ChevronLeft className="size-[18px]" />
      </button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="border-line bg-surface text-ink-900 hover:border-ink-300 data-[state=open]:border-brand-500 inline-flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors"
          >
            <CalendarDays className="text-brand-500 size-[18px]" />
            <span className="tabular">{fmtDate(value)}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="center">
          <Calendar
            mode="single"
            selected={isoToDate(value)}
            defaultMonth={isoToDate(value)}
            onSelect={(d) => {
              if (!d) return;
              go(dateToISO(d));
              setOpen(false);
            }}
            disabled={[
              ...(min ? [{ before: isoToDate(min) }] : []),
              ...(max ? [{ after: isoToDate(max) }] : []),
              ...(isDisabled ? [(d: Date) => isDisabled(dateToISO(d))] : []),
            ]}
          />
          {(!max || today <= max) && (!min || today >= min) && (
            <button
              type="button"
              onClick={() => {
                go(today);
                setOpen(false);
              }}
              className="bg-brand-50 text-brand-500 hover:bg-brand-100 mt-2 w-full rounded-full py-2 text-[13px] font-medium"
            >
              Today
            </button>
          )}
        </PopoverContent>
      </Popover>
      <button type="button" className={navBtn} disabled={!canNext} onClick={() => go(next)} aria-label="Next day">
        <ChevronRight className="size-[18px]" />
      </button>
    </div>
  );
}

/** ◀ Sep 2026 ▶ for the logsheet calendar and monthly reports. `value` = 'YYYY-MM'. */
export function MonthNav({
  value,
  onChange,
  min,
  max,
  className,
}: {
  value: string;
  onChange: (m: string) => void;
  min?: string | null;
  max?: string | null;
  className?: string;
}) {
  const first = `${value}-01`;
  const prev = addMonths(first, -1).slice(0, 7);
  const next = addMonths(first, 1).slice(0, 7);
  const canPrev = !min || prev >= min.slice(0, 7);
  const canNext = !max || next <= max.slice(0, 7);
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        className={navBtn}
        disabled={!canPrev}
        onClick={() => onChange(prev)}
        aria-label="Previous month"
      >
        <ChevronLeft className="size-[18px]" />
      </button>
      <span className="border-line bg-surface text-ink-900 inline-flex h-10 min-w-[130px] items-center justify-center rounded-full border px-4 text-sm font-semibold">
        {fmtMonth(first)}
      </span>
      <button
        type="button"
        className={navBtn}
        disabled={!canNext}
        onClick={() => onChange(next)}
        aria-label="Next month"
      >
        <ChevronRight className="size-[18px]" />
      </button>
    </div>
  );
}
