'use client';

import { CalendarDays, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  dateToISO,
  detectPreset,
  isoToDate,
  presetRange,
  RANGE_PRESETS,
  todayIST,
  type DateRange,
  type RangePreset,
} from '@/lib/dates';
import { fmtDate } from '@/lib/format';
import { useIsDesktop } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Calendar } from './calendar';

/**
 * The video's date pill: [📅 1-Sep-2026 – 30-Sep-2026 | Last 30 days ⌄].
 * Presets on the left, a 2-month range calendar on the right, Apply/Cancel. Dates are 'YYYY-MM-DD' (IST).
 * `min`/`max` usually = the plant's MIS start and today (dates outside the contract are disabled).
 */
export function DateRangePicker({
  value,
  onChange,
  min,
  max,
  presets = RANGE_PRESETS.map((p) => p.id),
  className,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  min?: string | null;
  max?: string | null;
  presets?: Array<Exclude<RangePreset, 'custom'>>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date } | undefined>();
  const desktop = useIsDesktop();
  const today = todayIST();
  const preset = detectPreset(value, today);
  const label = RANGE_PRESETS.find((p) => p.id === preset)?.label ?? 'Custom';

  const clamp = (r: DateRange): DateRange => ({
    from: min && r.from < min ? min : r.from,
    to: max && r.to > max ? max : r.to,
  });

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft({ from: isoToDate(value.from), to: isoToDate(value.to) });
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'border-line bg-surface text-ink-700 hover:border-ink-300 data-[state=open]:border-brand-500 data-[state=open]:ring-brand-500/10 inline-flex h-10 items-center gap-2.5 rounded-full border pr-3 pl-3.5 text-sm font-medium transition-colors data-[state=open]:ring-4',
            className,
          )}
        >
          <CalendarDays className="text-ink-500 size-[18px]" />
          <span className="tabular whitespace-nowrap">
            {fmtDate(value.from)}
            {value.to !== value.from && <> – {fmtDate(value.to)}</>}
          </span>
          <span className="bg-line hidden h-5 w-px sm:block" />
          <span className="hidden items-center gap-1 whitespace-nowrap sm:inline-flex">
            {label}
            <ChevronDown className="text-ink-500 size-4" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="scrollbar-none border-line flex gap-1 overflow-x-auto border-b p-2 sm:w-44 sm:flex-col sm:border-r sm:border-b-0">
            {presets.map((id) => {
              const p = RANGE_PRESETS.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChange(clamp(presetRange(id, today)));
                    setOpen(false);
                  }}
                  className={cn(
                    'rounded-xl px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap transition-colors',
                    preset === id ? 'bg-brand-50 text-brand-500' : 'text-ink-700 hover:bg-canvas',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              numberOfMonths={desktop ? 2 : 1}
              selected={draft?.from ? { from: draft.from, to: draft.to } : undefined}
              onSelect={(r) => setDraft(r ? { from: r.from, to: r.to } : undefined)}
              defaultMonth={isoToDate(value.from)}
              disabled={[...(min ? [{ before: isoToDate(min) }] : []), ...(max ? [{ after: isoToDate(max) }] : [])]}
            />
            <div className="border-line mt-3 flex items-center justify-between gap-2 border-t pt-3">
              <span className="text-ink-500 tabular text-xs">
                {draft?.from ? fmtDate(dateToISO(draft.from)) : '…'} – {draft?.to ? fmtDate(dateToISO(draft.to)) : '…'}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!draft?.from}
                  onClick={() => {
                    if (!draft?.from) return;
                    const from = dateToISO(draft.from);
                    onChange(clamp({ from, to: draft.to ? dateToISO(draft.to) : from }));
                    setOpen(false);
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
