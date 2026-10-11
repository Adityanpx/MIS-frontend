'use client';

import { usePlantDate } from '../plant-date';
import { LogsheetCalendar } from './logsheet-calendar';
import { LogsheetDay } from './logsheet-day';

/** /plants/:id/logsheet → month calendar · /plants/:id/logsheet/2026-10-06 → that day's logsheet. */
export function LogsheetView() {
  const { date } = usePlantDate('logsheet');
  // keyed by date: every day gets a fresh editor (its own lock, autosave timer and values)
  return date ? <LogsheetDay key={date} date={date} /> : <LogsheetCalendar />;
}
