/**
 * Response shapes of the calculation engine (backend Phase 2 §5.6–5.7 + the File 2 additions).
 * Mirrors `MisReport` / `Dashboard` exactly. Percentages are FRACTIONS (0.0333 = 3.33 %).
 * Flags: 'ok' = favourable (blue in the Excel), 'bad' = unfavourable (red), 'neutral'.
 */
export type Flag = 'ok' | 'bad' | 'neutral';
export type BadgeColour = 'blue' | 'red' | 'grey';

export interface Triple {
  std: number | null;
  act: number | null;
  var: number | null;
  varFlag: Flag;
}

export interface ParamRow {
  code: string;
  name: string;
  unit: string;
  decimals: number;
  direction: 'higher_better' | 'lower_better' | 'within_range' | 'neutral' | string;
  today: Triple;
  mtd: Triple;
  utd: Triple;
  avgPerDay: { mtd: number | null; utd: number | null };
  events: { mtd: number; utd: number; flag: Flag };
  utdResult: { pct: number | null; text: string | null; flag: Flag };
  mtdPct: number | null;
}
export interface ChemicalRow extends ParamRow {
  received: number | null;
  balance: number | null;
  balanceFlag: Flag;
}

export interface LabRow {
  code: string;
  name: string;
  unit: string;
  decimals: number;
  min: number | null;
  max: number | null;
  act: number | null;
  result: 'WITHIN LIMIT' | 'EXCEEDED LIMIT' | null;
  resultFlag: Flag;
  avg: { mtd: number | null; utd: number | null };
  events: { mtd: number; utd: number; flag: Flag };
}

export type RegisterStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NOT_AVAILABLE';
export interface RegisterRow {
  label: string;
  kind?: 'bg' | 'insurance';
  number?: string;
  party?: string;
  start?: string;
  end?: string;
  amount?: number | null;
  premium?: number | null;
  sumAssured?: number | null;
  claimMonths?: number | null;
  claimUpTo: string | null;
  status: RegisterStatus;
  statusFlag: Flag;
}

export interface LogsheetInfo {
  status: string;
  version: number;
  submittedBy: string | null;
  submittedAt: string | null;
}

export interface MisReport {
  header: {
    companyName: string;
    plantName: string;
    clientName: string;
    misStart: string;
    omStart: string;
    omEnd: string;
    tenureMonths: number;
    omMonthNo: number;
    omYearNo: string | null;
    reportDate: string;
    mtdDays: number;
    utdDays: number;
    mtdDataDays: number;
    utdDataDays: number;
    monthsElapsed: number;
    lastCorrectedAt: string | null;
    logsheet: LogsheetInfo | null;
  };
  keyParameters: ParamRow[];
  chemicals: ChemicalRow[];
  lab: { inlet: LabRow[]; outlet: LabRow[] };
  registers: { bankGuarantees: RegisterRow[]; insurance: RegisterRow[] };
  cash: {
    today: number | null;
    mtd: number;
    utd: number;
    received: number | null;
    inHand: number | null;
    description: string | null;
    alertLimit: number | null;
  };
  staff: {
    rows: Array<{
      category: string;
      contract: number;
      vacant: number | null;
      present: number | null;
      leave: number | null;
      absent: number | null;
      absentFlag: Flag;
    }>;
    total: Record<string, number>;
  };
  safety: {
    rows: Array<{ item: string; required: number; actual: number | null; deficit: number | null; deficitFlag: Flag }>;
    total: Record<string, number>;
  };
  revenueDay: { fixedPerDay: number; std: number; act: number } | null;
  meta: { generatedAt: string };
  versions: { data: number; settings: number };
}

export interface Badge {
  pct: number | null;
  arrow: 'up' | 'down' | null;
  colour: BadgeColour;
}
export interface CardChart {
  type: 'bar' | 'cone' | 'line' | string;
  title: string;
  months: string[];
  values: Array<number | null>;
}

export interface ParamCard {
  code: string;
  title: string;
  unit: string;
  section: 'key' | 'chemicals';
  bigNumber: number | null;
  mtd: Badge & { value: number | null };
  utd: Badge & { value: number | null };
  events: { mtd: number; utd: number; flag: Flag };
  chart: CardChart;
}
export interface QualityCard {
  code: string;
  title: string;
  unit: string;
  bigNumber: number | null;
  min: number | null;
  max: number | null;
  result: LabRow['result'];
  resultFlag: Flag;
  events: LabRow['events'];
  chart: CardChart;
}

export type AlertLevel = 'critical' | 'warning' | 'info';
export interface PlantAlert {
  id: string;
  level: AlertLevel;
  kind: 'lab' | 'stock' | 'register' | 'cash' | 'staff' | 'safety' | 'param' | 'logsheet';
  title: string;
  detail: string;
  code: string | null;
}
export interface DashboardSummary {
  compliance: {
    mtdPct: number | null;
    utdPct: number | null;
    exceedancesMtd: number;
    exceedancesUtd: number;
    testsMtd: number;
    testsUtd: number;
    failingToday: number;
    parameters: number;
  };
  dataDays: { mtd: number; mtdDays: number; utd: number; utdDays: number };
  omMonthNo: number;
  omYearNo: string | null;
}

export interface DashboardData {
  header: {
    title: string;
    subtitle: string;
    tagline: string;
    reportDate: string;
    reportMonth: string;
    plantName: string;
    companyName: string;
    logsheet: LogsheetInfo | null;
  };
  keyParameters: ParamCard[];
  chemicals: ParamCard[];
  quality: QualityCard[];
  registers: MisReport['registers'];
  staff: Array<{ category: string; present: number | null; absent: number | null; absentFlag: Flag }>;
  cash: { today: number | null; mtd: number; utd: number; inHand: number | null; chart: CardChart | null };
  flags: Record<string, boolean | Flag>;
  alerts: PlantAlert[];
  summary: DashboardSummary;
  versions: { data: number; settings: number };
}

/** GET /plants/:id/reports/* (ReportTable). Trend rows: { date, value, std, min, max, event }. */
export interface ReportTable<R = Record<string, string | number | null>> {
  title: string;
  subtitle?: string;
  columns: Array<{ key: string; header: string; numFmt?: string; width?: number }>;
  rows: R[];
  footer?: R[];
  meta?: Record<string, unknown>;
}
export interface TrendRow {
  date: string;
  value: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  event: string;
}

/** GET /api/v1/overview (File 2 backend addition). */
export interface OverviewPlant {
  plantId: string;
  code: string;
  name: string;
  type: string;
  capacityMld: number;
  city: string | null;
  setupStatus: 'settings_pending' | 'live' | 'closed';
  accountState: string;
  myRole: 'client_admin' | 'editor' | 'checker' | 'verifier' | 'viewer';
  misStart: string;
  omEnd: string;
  reportDate: string | null;
  lastLogsheetDate: string | null;
  expected: {
    date: string;
    status: 'submitted' | 'corrected' | 'checked' | 'verified' | 'returned' | 'draft' | 'missing' | 'not_due';
  };
  submissions30d: { submitted: number; days: number };
  primary: {
    code: string;
    name: string;
    unit: string;
    decimals: number;
    today: number | null;
    mtdAvg: number | null;
    mtd: number | null;
    badge: Badge;
  } | null;
  revenue: { mtdAct: number | null; mtdStd: number | null; badge: Badge } | null;
  compliance: DashboardSummary['compliance'] | null;
  spark: Array<{ date: string; value: number | null }>;
  alerts: PlantAlert[];
  alertCount: Record<AlertLevel, number>;
}
export interface Overview {
  generatedAt: string;
  expectedDate: string;
  plants: OverviewPlant[];
  totals: {
    plants: number;
    live: number;
    settingsPending: number;
    expected: number;
    submitted: number;
    alerts: Record<AlertLevel, number>;
    revenueMtd: { act: number; std: number; badge: Badge };
  };
}

export interface PdfDoc {
  id: string;
  date: string;
  doc_type: 'logsheet' | 'mis' | 'dashboard';
  version: number;
  status: 'current' | 'superseded' | 'stale' | 'failed';
  reason: string | null;
  size_bytes: number | null;
  generated_at: string | null;
}
