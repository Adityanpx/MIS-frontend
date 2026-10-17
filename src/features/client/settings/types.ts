/** Exact response shapes of /plants/:plantId/settings/* (backend Phase 2 §4.6 settings.service.ts). */

export interface GeneralSettings {
  name: string;
  code: string;
  type: string;
  capacityMld: number;
  omStart: string;
  omTenureMonths: number;
  omEnd: string;
  misStart: string;
  setupStatus: 'settings_pending' | 'live' | 'closed';
  endCustomerName: string | null;
  reportCompanyName: string | null;
  logsheetTitle: string | null;
  dashboardTitle: string | null;
  tagline: string;
  sigPreparedLabel: string;
  sigCheckedLabel: string;
  sigVerifiedLabel: string;
  allowSameDay: boolean;
  editorBackfillDays: number;
  approvalEnabled: boolean;
  avgDivisor: 'calendar_days' | 'data_days';
  pdfPrefixMis: string;
}

export interface StandardRow {
  effectiveFrom: string;
  std: number | null;
  monthly: number | null;
  min: number | null;
  max: number | null;
  inheritFromKind?: StandardKind | null;
  reason: string | null;
}
export type StandardKind = 'bidding' | 'actual';
export type StandardsByKind = Record<StandardKind, StandardRow[]>;
export const STANDARD_KIND_LABEL: Record<StandardKind, string> = { bidding: 'Bidding', actual: 'Actual' };

export type ParamGroup = 'key' | 'chemical' | 'lab_inlet' | 'lab_outlet' | 'safety' | 'staff' | 'cash' | 'other';
export interface ParameterDto {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  groupKey: ParamGroup;
  unit: string;
  inputMode: 'typed' | 'calculated' | 'suggested';
  formula: string | null;
  decimals: number;
  hardMin: number | null;
  hardMax: number | null;
  aggregation: 'sum' | 'avg' | 'snapshot' | 'stock' | 'text';
  stdType: 'per_day' | 'monthly_allowance' | 'range' | 'required_qty' | 'none';
  direction: 'higher_better' | 'lower_better' | 'within_range' | 'neutral';
  eventRule: 'above_std' | 'below_std' | 'outside_range' | 'none';
  resultNoun: string | null;
  linkRole: string | null;
  stockItemId: string | null;
  staffCategoryId: string | null;
  safetyItemId: string | null;
  logsheetBlock: number | null;
  logsheetOrder: number | null;
  misSection: 'key' | 'chemicals' | 'lab_inlet' | 'lab_outlet' | null;
  misOrder: number | null;
  dashboardCard: boolean;
  dashboardOrder: number | null;
  chartType: 'bar' | 'line' | 'cone' | 'none';
  chartMetric: 'avg_per_day' | 'monthly_total' | null;
  mandatory: boolean;
  activeFrom: string | null;
  activeTo: string | null;
  standards: StandardsByKind;
}

export interface ConstantRow {
  code: string;
  name: string;
  value: number;
  unit: string | null;
  effectiveFrom: string;
  reason: string | null;
}

export interface StockItemDto {
  id: string;
  name: string;
  unit: string;
  openingBalance: number;
  openingDate: string | null;
  minLevel: number | null;
  displayOrder: number;
  isActive: boolean;
  code: string;
  stdPerDay: number | null;
}

export interface StaffDto {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  strengths: Array<{ effectiveFrom: string; strength: number; reason: string | null }>;
}
export interface SafetyDto {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  requirements: Array<{ effectiveFrom: string; qty: number; reason: string | null }>;
}

export interface RevenueComponent {
  id: string;
  name: string;
  parameterCode: string;
  rate: number;
  stdQtyPerDay: number;
}
export interface ContractYear {
  yearNo: number;
  startDate: string;
  endDate: string;
  days: number;
  /** money as a string with 2 decimals */
  fixedFee: string;
  feeConfigured: boolean;
  components: RevenueComponent[];
  derived: {
    fixedPerDay: string;
    fixedPerMonth: string;
    variableStdPerDay: string;
    variableStdPerMonth: string;
    variableStdPerYear: string;
    contractValue: string;
  };
}
export interface ContractYears {
  years: ContractYear[];
  totalContractValue: string;
}

export interface CashSettings {
  cashOpening: number;
  cashOpeningDate: string;
  cashAlertLimit: number | null;
  pettyFloat: number | null;
}

export interface BankGuarantee {
  id: string;
  label: string;
  bgNumber: string;
  bank: string;
  startDate: string;
  endDate: string;
  amount: string;
  claimMonths: number;
  remarks: string | null;
  documentUrl: string | null;
}
export interface InsurancePolicy {
  id: string;
  policyType: string;
  policyNumber: string;
  insurer: string;
  startDate: string;
  endDate: string;
  sumAssured: string | null;
  premium: string | null;
  remarks: string | null;
  documentUrl: string | null;
}

export interface GoLiveCheck {
  ready: boolean;
  items: Array<{ key: string; ok: boolean; message: string }>;
}

export const GROUP_LABEL: Record<ParamGroup, string> = {
  key: 'Key parameters',
  chemical: 'Chemicals',
  lab_inlet: 'Inlet lab',
  lab_outlet: 'Outlet lab',
  safety: 'Safety',
  staff: 'Staff',
  cash: 'Site cash',
  other: 'Other',
};
export const BLOCK_LABEL: Record<number, string> = {
  1: 'Key plant parameters',
  2: 'Chemicals & consumables',
  3: 'Inlet lab',
  4: 'Outlet lab',
  5: 'Safety items',
  6: 'Staff attendance',
  7: 'Site cash',
  8: 'Other',
};
export const LINK_ROLE_LABEL: Record<string, string> = {
  consumed: 'Stock item (consumed)',
  received: 'Stock item (received)',
  vacant: 'Staff (vacant)',
  present: 'Staff (present)',
  leave: 'Staff (on leave)',
  available: 'Safety item',
  expense: 'Site cash (expense)',
  cash_received: 'Site cash (received)',
  description: 'Site cash (description)',
};
