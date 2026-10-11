/** Exact shapes of /plants/:plantId/logsheets/* (backend Phase 2 §6.4 logsheets.service.ts). */

export type LogStatus = 'draft' | 'submitted' | 'corrected' | 'returned' | 'checked' | 'verified';
export type DayStatus = LogStatus | 'missing' | 'future' | 'not_allowed';
export type DateBlockReason = 'OUTSIDE_CONTRACT' | 'FUTURE_DATE' | 'PLANT_NOT_LIVE' | 'OUTSIDE_BACKFILL_WINDOW';

/** Statuses after submission (the logsheet is locked for normal editing). */
export const SUBMITTED_STATUSES: LogStatus[] = ['submitted', 'corrected', 'checked', 'verified'];

export interface CalendarDay {
  date: string;
  status: DayStatus;
  reason: DateBlockReason | null;
  submittedBy: string | null;
  submittedAt: string | null;
}
export interface LogCalendar {
  month: string;
  days: CalendarDay[];
}

export interface FormStandard {
  std: number | null;
  min: number | null;
  max: number | null;
  monthly: number | null;
}

export interface FormField {
  parameterId: string;
  code: string;
  name: string;
  unit: string;
  inputMode: 'typed' | 'calculated' | 'suggested';
  formula: string | null;
  decimals: number;
  hardMin: number | null;
  hardMax: number | null;
  aggregation: 'sum' | 'avg' | 'snapshot' | 'stock' | 'text';
  direction: 'higher_better' | 'lower_better' | 'within_range' | 'neutral';
  eventRule: 'above_std' | 'below_std' | 'outside_range' | 'none';
  mandatory: boolean;
  /** consumed / received (stock) · vacant / present / leave (staff) · available (safety) · expense / cash_received / description (cash) */
  linkRole: string | null;
  standard: FormStandard | null;
}

export interface FormBlock {
  block: number;
  title: string;
  fields: FormField[];
}

export interface LogsheetForm {
  date: string;
  rule: { allowed: boolean; reason: DateBlockReason | null };
  canEdit: boolean;
  canCorrect: boolean;
  logsheet: {
    id: string;
    status: LogStatus;
    version: number;
    source: string;
    remarks: string | null;
    submittedBy: string | null;
    submittedAt: string | null;
    /** set only when ANOTHER user holds the edit lock */
    lock: { byName: string | null; until: string | null } | null;
  } | null;
  blocks: FormBlock[];
  /** by parameterId; calculated parameters are never stored */
  values: Record<string, number | string>;
  context: {
    previousClosing: Record<string, number | null>;
    stockItems: Array<{
      code: string;
      name: string;
      consumedCode: string;
      receivedCode: string;
      minLevel: number | null;
    }>;
    previousCash: number | null;
    cashAlertLimit: number | null;
    staff: Array<{
      code: string;
      name: string;
      strength: number;
      vacantCode: string;
      presentCode: string;
      leaveCode: string;
    }>;
    constants: Record<string, number | null>;
  };
}

export type ValueOut = number | string | null;
export interface ValueItem {
  parameterId: string;
  value: ValueOut;
}

export interface FieldIssue {
  code: string;
  parameterId: string;
  message: string;
}

export interface DraftResult {
  id: string;
  status: 'draft';
  version: number;
}
export interface SubmitResult {
  id: string;
  status: 'submitted';
  version: number;
  warnings: FieldIssue[];
  dataVersion: number;
}
export interface CorrectResult {
  id: string;
  status: 'corrected';
  version: number;
  changed: number;
}

/** GET /:date/history (numeric columns arrive as strings from PostgreSQL). */
export interface HistoryRow {
  version: number;
  code: string;
  name: string;
  old_num: string | number | null;
  new_num: string | number | null;
  old_text: string | null;
  new_text: string | null;
  changed_by: string | null;
  changed_at: string;
  reason: string;
}

/** GET /correction-requests */
export interface CorrectionRequest {
  id: string;
  date: string;
  reason: string;
  proposed: ValueItem[];
  status: 'pending' | 'approved' | 'rejected';
  comment: string | null;
  created_at: string;
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
}

export const BLOCK_REASON_TEXT: Record<DateBlockReason, { title: string; text: string }> = {
  OUTSIDE_CONTRACT: {
    title: 'Outside the MIS period',
    text: 'This date is before the MIS start or after the O&M contract end, so no logsheet can be entered.',
  },
  FUTURE_DATE: {
    title: 'Not open yet',
    text: 'A day’s logsheet opens once the day is over (same-day entry is switched off for this plant).',
  },
  PLANT_NOT_LIVE: {
    title: 'Plant is not live yet',
    text: 'Logsheets open after the Client Admin completes the plant settings and takes the plant live.',
  },
  OUTSIDE_BACKFILL_WINDOW: {
    title: 'Too far in the past',
    text: 'Editors can only fill recent days. Ask your Client Admin to enter or import this date.',
  },
};
