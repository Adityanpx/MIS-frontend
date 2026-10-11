/** GET /plants/:plantId/imports/:id (backend Phase 2 §10). */
export type ImportStatus = 'validating' | 'validated' | 'applying' | 'applied' | 'failed';
export type ImportMapping = 'template' | 'excel_data_entry';

export interface ImportIssue {
  row: number;
  column: string;
  code?: string;
  message: string;
  value?: unknown;
}

export interface ImportReport {
  rows?: number;
  firstDate?: string | null;
  lastDate?: string | null;
  errorRows?: number;
  errors?: ImportIssue[];
  conversions?: ImportIssue[];
  /** dates that already have a submitted logsheet */
  duplicates?: string[];
  unknownColumns?: string[];
  suggestedOpenings?: { stock: Record<string, number>; cash: number | null; asOf: string | null };
  applied?: { inserted: number; skipped: number; errorRowsSkipped: number };
  fatal?: string;
}

export interface ImportJob {
  id: string;
  mapping: ImportMapping;
  status: ImportStatus;
  report: ImportReport | null;
  options: Record<string, unknown> | null;
  created_at: string;
}

export interface ApplyBody {
  skipErrorRows: boolean;
  existing: 'skip' | 'overwrite';
  reason?: string;
  openings?: { stock?: Record<string, number>; cash?: number; asOf?: string };
}
