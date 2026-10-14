/**
 * Response shapes of the calculation engine — v1.1.
 * Percentages are FRACTIONS (0.0333 = 3.33 %).
 * Flags: 'ok' = favourable (blue), 'bad' = unfavourable (red), 'neutral'.
 *
 * NOTE: StandardKind, StandardsShown, ResultMode, MonitoringTab, BreakdownStatus,
 * Criticality, Impact, CauseCategory will move to `@/shared/enums` imports after
 * `npm run sync:shared` brings the backend v1.1 additions.
 */
export type Flag = 'ok' | 'bad' | 'neutral';
export type BadgeColour = 'blue' | 'red' | 'grey';

// ---------------------------------------------------------------------------
// v1.1 enums (local until backend sync adds them to src/shared/enums.ts)
// ---------------------------------------------------------------------------
export type StandardKind = 'bidding' | 'actual';
export type StandardsShown = 'bidding' | 'actual' | 'both';
export type ResultMode = 'pct' | 'qty' | 'both' | 'none';
export type MonitoringTab = 'key' | 'chemicals' | 'compliance' | 'administrative' | 'maintenance';
export type BreakdownStatus = 'open' | 'in_progress' | 'awaiting_spares' | 'restored' | 'cancelled';
export type Criticality = 'critical' | 'major' | 'minor';
export type Impact = 'none' | 'reduced_capacity' | 'bypass' | 'plant_stopped';
export type CauseCategory =
  | 'mechanical'
  | 'electrical'
  | 'instrumentation'
  | 'civil'
  | 'operational'
  | 'other';

// ---------------------------------------------------------------------------
// Core value shapes
// ---------------------------------------------------------------------------
export interface Triple {
  std: number | null;
  act: number | null;
  var: number | null;
  varFlag: Flag;
}

export interface ResultLine {
  qty: number | null;
  pct: number | null;
  text: string | null;
  flag: Flag;
}

export interface PerKind {
  today: Triple;
  mtd: Triple;
  utd: Triple;
  events: { mtd: number; utd: number; flag: Flag };
  results: { today: ResultLine; mtd: ResultLine; utd: ResultLine };
}

// ---------------------------------------------------------------------------
// Parameter rows
// ---------------------------------------------------------------------------
export interface ParamRow {
  code: string;
  name: string;
  unit: string;
  decimals: number;
  direction: 'higher_better' | 'lower_better' | 'within_range' | 'neutral' | string;
  monitoringTab: MonitoringTab;
  resultDisplay: ResultMode;
  standards: { bidding: PerKind; actual: PerKind };
  primaryKind: StandardKind;
  avgPerDay: { mtd: number | null; utd: number | null };
  // Legacy flat keys (v1.0 payloads). Ignore when `standards` is present.
  today?: Triple;
  mtd?: Triple;
  utd?: Triple;
  events?: { mtd: number; utd: number; flag: Flag };
  utdResult?: { pct: number | null; text: string | null; flag: Flag };
  mtdPct?: number | null;
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
  resultToday: 'WITHIN LIMIT' | 'EXCEEDED LIMIT' | null;
  resultTodayFlag: Flag;
  resultMtd: 'WITHIN LIMIT' | 'EXCEEDED LIMIT' | null;
  resultMtdFlag: Flag;
  resultUtd: 'WITHIN LIMIT' | 'EXCEEDED LIMIT' | null;
  resultUtdFlag: Flag;
  avg: { mtd: number | null; utd: number | null };
  events: { mtd: number; utd: number; flag: Flag };
  // Legacy (v1.0)
  result?: 'WITHIN LIMIT' | 'EXCEEDED LIMIT' | null;
  resultFlag?: Flag;
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

// ---------------------------------------------------------------------------
// Cash / Staff / Safety sub-shapes reused by MisTabsPayload & MisReport
// ---------------------------------------------------------------------------
export interface CashBlock {
  today: number | null;
  mtd: number;
  utd: number;
  received: number | null;
  inHand: number | null;
  description: string | null;
  alertLimit: number | null;
}

export interface StaffRow {
  category: string;
  contract: number;
  vacant: number | null;
  present: number | null;
  leave: number | null;
  absent: number | null;
  absentFlag: Flag;
}

export interface StaffTotals {
  contract: number;
  vacant: number | null;
  present: number | null;
  absent: number | null;
}

export interface SafetyRow {
  item: string;
  required: number;
  actual: number | null;
  deficit: number | null;
  deficitFlag: Flag;
}

export interface SafetyTotals {
  required: number;
  actual: number | null;
  deficit: number | null;
}

// ---------------------------------------------------------------------------
// Maintenance shapes (v1.1)
// ---------------------------------------------------------------------------
export interface MaintenanceMetrics {
  reported: number;
  restored: number;
  openEndD: number;
  criticalOpen: number;
  downtimeHrs: number;
  mttrHrs: number | null;
  availabilityPct: number | null;
  criticalAvailabilityPct: number | null;
  longestOpenDays: number | null;
  repeatBreakdowns: number;
}

export interface BreakdownSummary {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  criticality: Criticality;
  status: BreakdownStatus;
  startedAt: string;
  restoredAt: string | null;
  impact: Impact;
  expectedRestoreOn: string | null;
  fault: string;
}

export interface MaintenanceTabPayload {
  summary: {
    openNow: number;
    criticalOpen: number;
    restoredToday: number;
    downtimeMtd: number;
    availabilityMtd: number | null;
    availabilityUtd: number | null;
  };
  metrics: Record<'today' | 'mtd' | 'utd', MaintenanceMetrics>;
  openBreakdowns: BreakdownSummary[];
  restoredToday: BreakdownSummary[];
  restoredMtd: BreakdownSummary[];
  topByDowntime: Array<{
    equipmentId: string;
    equipmentName: string;
    downtimeHrs: number;
    count: number;
  }>;
}

// ---------------------------------------------------------------------------
// MIS v1.1 header + tabs
// ---------------------------------------------------------------------------
export interface MisReportHeader {
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
  // v1.1
  standardsShown: StandardsShown;
  resultsDisplay: ResultMode;
  primaryStandard: StandardKind;
  tabLabels: Partial<Record<MonitoringTab, string>>;
}

export interface MisTabsPayload {
  key: ParamRow[];
  chemicals: ChemicalRow[];
  compliance: {
    lab: { inlet: LabRow[]; outlet: LabRow[] };
    registers: { bankGuarantees: RegisterRow[]; insurance: RegisterRow[] };
  };
  administrative: {
    cash: CashBlock;
    staff: { rows: StaffRow[]; total: StaffTotals };
    safety: { rows: SafetyRow[]; total: SafetyTotals };
    submission: {
      mtdSubmitted: number;
      mtdTotal: number;
      utdSubmitted: number;
      utdTotal: number;
      missing: string[];
      by: { name: string | null; at: string | null };
    };
  };
  maintenance: MaintenanceTabPayload | null;
}

// v1.1 MIS response shape
export interface MisReportV11 {
  header: MisReportHeader;
  tabs: MisTabsPayload;
  meta: { generatedAt: string };
  versions: { data: number; settings: number };
}

// ---------------------------------------------------------------------------
// Legacy MIS (v1.0) — kept for fallback
// ---------------------------------------------------------------------------
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
  cash: CashBlock;
  staff: {
    rows: StaffRow[];
    total: Record<string, number>;
  };
  safety: {
    rows: SafetyRow[];
    total: Record<string, number>;
  };
  revenueDay: { fixedPerDay: number; std: number; act: number } | null;
  meta: { generatedAt: string };
  versions: { data: number; settings: number };
  // v1.1 fields (present when backend is v1.1)
  tabs?: MisTabsPayload;
}

// ---------------------------------------------------------------------------
// Dashboard v1.1
// ---------------------------------------------------------------------------
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

/** v1.1 dashboard card — carries both standards + three result lines. */
export interface DashboardCard {
  code: string;
  title: string;
  unit: string;
  decimals: number;
  section: string;
  bigNumber: number | null;
  standards: ParamRow['standards'];
  resultDisplay: ResultMode;
  results: PerKind['results'];
  mtd: Badge & { value: number | null };
  utd: Badge & { value: number | null };
  events: { mtd: number; utd: number; flag: Flag };
  chart: CardChart;
}

/** Legacy dashboard card (v1.0). */
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
    // v1.1
    standardsShown?: StandardsShown;
    resultsDisplay?: ResultMode;
    tabLabels?: Partial<Record<MonitoringTab, string>>;
  };
  // v1.1 tabs structure
  tabs?: {
    key: DashboardCard[];
    chemicals: DashboardCard[];
    compliance: {
      lab: { inlet: LabRow[]; outlet: LabRow[] };
      registers: MisReport['registers'];
    };
    administrative: {
      staff: Array<{ category: string; present: number | null; absent: number | null; absentFlag: Flag }>;
      cash: { today: number | null; mtd: number; utd: number; inHand: number | null; chart: CardChart | null };
    };
    maintenance: MaintenanceTabPayload | null;
  };
  // Legacy flat keys (v1.0)
  keyParameters?: ParamCard[];
  chemicals?: ParamCard[];
  quality?: QualityCard[];
  registers?: MisReport['registers'];
  staff?: Array<{ category: string; present: number | null; absent: number | null; absentFlag: Flag }>;
  cash?: { today: number | null; mtd: number; utd: number; inHand: number | null; chart: CardChart | null };
  flags: Record<string, boolean | Flag>;
  alerts: PlantAlert[];
  summary: DashboardSummary;
  versions: { data: number; settings: number };
}

// ---------------------------------------------------------------------------
// Portfolio (v1.1)
// ---------------------------------------------------------------------------
export interface PortfolioRow {
  plantId: string;
  name: string;
  type: string;
  capacityMld: number;
  accountState: string;
  logsheetStatus: 'submitted' | 'draft' | 'missing' | 'not_allowed' | 'suspended';
  key: {
    inflowAct: number | null;
    ebAct: number | null;
    bgeAct: number | null;
    dgAct: number | null;
    revenueAct: number | null;
    inflowResultToday: string | null;
    ebResultToday: string | null;
  };
  chemicals: { aboveMtd: number; belowMin: number };
  compliance: {
    outletToday: 'within' | 'exceeded' | 'no_data';
    outletEventsMtd: number;
    worstRegister: 'ok' | 'expiring' | 'expired' | 'not_available';
  };
  administrative: { staffAbsent: number; safetyDeficit: number; cashInHand: number | null };
  maintenance: {
    openBreakdowns: number;
    criticalOpen: number;
    longestOpenDays: number | null;
    availabilityMtd: number | null;
  };
  exceptions: number;
}

// ---------------------------------------------------------------------------
// Reports + Overview (unchanged)
// ---------------------------------------------------------------------------
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
