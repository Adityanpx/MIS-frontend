'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, type DayPickerProps } from 'react-day-picker';

/** react-day-picker v9 styled with the design tokens (no default stylesheet needed). */
export function Calendar(props: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      weekStartsOn={1}
      classNames={{
        root: 'relative select-none',
        months: 'relative flex flex-col gap-6 sm:flex-row',
        month: 'space-y-3',
        month_caption: 'flex h-9 items-center justify-center',
        caption_label: 'text-sm font-semibold text-ink-900',
        nav: 'absolute inset-x-0 top-0 z-10 flex h-9 items-center justify-between',
        button_previous:
          'grid size-9 place-items-center rounded-full text-ink-700 transition-colors hover:bg-muted-bg disabled:opacity-30',
        button_next:
          'grid size-9 place-items-center rounded-full text-ink-700 transition-colors hover:bg-muted-bg disabled:opacity-30',
        month_grid: 'w-full border-collapse',
        weekdays: '',
        weekday: 'h-8 w-9 text-[11px] font-medium uppercase tracking-wide text-ink-400',
        week: '',
        day: 'p-0 text-center text-sm',
        day_button:
          'mx-auto my-0.5 grid size-9 place-items-center rounded-full text-ink-700 tabular transition-colors hover:bg-muted-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        selected:
          '[&>button]:bg-brand-500 [&>button]:font-semibold [&>button]:text-white [&>button]:hover:bg-brand-600',
        range_start: 'rounded-l-full bg-brand-50',
        range_end: 'rounded-r-full bg-brand-50',
        range_middle: 'bg-brand-50 [&>button]:bg-transparent! [&>button]:font-medium! [&>button]:text-brand-600!',
        today: '[&>button]:font-bold [&>button]:text-brand-500',
        outside: 'opacity-40',
        disabled: 'pointer-events-none opacity-30',
        hidden: 'invisible',
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
      }}
      {...props}
    />
  );
}
