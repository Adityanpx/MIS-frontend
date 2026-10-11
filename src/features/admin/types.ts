/** Response shapes of /api/admin/v1/* (backend Phases 1–3). Money = strings with 2 decimals. */

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  pin: string;
}
export interface Contact {
  name: string;
  email: string;
  mobile?: string;
}

export interface AdminClient {
  id: string;
  code: string;
  displayName: string;
  legalName: string;
  gstin: string | null;
  pan: string | null;
  stateCode: string;
  stateName: string;
  address: Address;
  primaryContact: Contact;
  billingEmails: string[];
  logoUrl: string | null;
  notes: string | null;
  force2fa: boolean;
  accountState: string;
  manualSuspended: boolean;
  holdUntil: string | null;
  status: string;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  createdAt: string;
  plantsCount: number;
  usersCount: number;
}

export interface AdminPlant {
  id: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  code: string;
  name: string;
  type: string;
  capacityMld: number;
  city: string | null;
  stateCode: string;
  omStart: string;
  omTenureMonths: number;
  omEnd: string;
  misStart: string;
  setupStatus: string;
  accountState: string;
  manualSuspended: boolean;
  holdUntil: string | null;
  closedAt: string | null;
  createdAt: string;
  planName?: string | null;
  subscriptionEnd?: string | null;
}

export interface ScheduleRow {
  id?: string;
  yearNo: number;
  periodFrom: string;
  periodTo: string;
  amount: string;
  plannedInvoiceDate: string;
  dueDate: string;
  invoiceId?: string | null;
  status?: 'invoiced' | 'planned';
}

export interface AdminSubscription {
  id: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  plantId: string;
  plantName: string;
  plantCode: string;
  planId: string;
  plan: {
    name: string;
    code: string;
    termYears: number;
    pricePerYear: string;
    escalationPct: string | number;
    upfrontDiscountPct: string | number;
  };
  pricePerYear: string;
  customPricePerYear: string | null;
  customReason: string | null;
  startDate: string;
  endDate: string;
  billingMode: 'yearly' | 'upfront';
  trialDays: number | null;
  status: string;
  createdAt: string;
  schedule?: ScheduleRow[];
  totalExGst?: string;
}

export interface AdminPlantDetail extends AdminPlant {
  contractYears: Array<{
    yearNo: number;
    startDate: string;
    endDate: string;
    days: number;
    fixedFee: string;
    feeConfigured: boolean;
  }>;
  subscription: AdminSubscription | null;
}

export interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  termYears: number;
  pricePerYear: string;
  escalationPct: number;
  upfrontDiscountPct: number;
  maxUsersPerPlant: number;
  storageGb: number;
  features: Record<string, boolean>;
  status: 'active' | 'archived';
  subscriptionsCount: number;
  createdAt: string;
}
export interface PriceTable {
  years: Array<{ yearNo: number; amount: string }>;
  totalExGst: string;
  gstRatePct: number;
  gst: string;
  totalIncGst: string;
  upfront: { discountPct: number; amountExGst: string; gst: string; totalIncGst: string; savingExGst: string };
}
export interface PlantPreview {
  plant: { omStart: string; omTenureMonths: number; omEnd: string; misStart: string };
  contractYears: Array<{ yearNo: number; startDate: string; endDate: string; days: number }>;
  subscription: {
    planName: string;
    termYears: number;
    startDate: string;
    endDate: string;
    billingMode: string;
    pricePerYear: string;
    totalExGst: string;
    status: string;
  };
  schedule: ScheduleRow[];
  firstInvoice: {
    taxable: string;
    gstType: string;
    ratePct: number;
    cgst: string;
    sgst: string;
    igst: string;
    gst: string;
    total: string;
    plannedInvoiceDate: string;
    dueDate: string;
  };
  warnings: string[];
}

export interface AdminInvoice {
  id: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  plants: string | null;
  number: string | null;
  fy: string | null;
  kind: string;
  issueDate: string | null;
  dueDate: string | null;
  placeOfSupply: string | null;
  gstType: string | null;
  gstRatePct: number;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  roundOff: string;
  total: string;
  paid: string;
  tds: string;
  creditNoted: string;
  advanceAdjusted: string;
  balance: string;
  status: string;
  pdfReady: boolean;
  payUrl: string | null;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
}
export interface AdminInvoiceDetail extends Omit<AdminInvoice, 'tds'> {
  lines: Array<{
    id: string;
    description: string;
    sac: string | null;
    qty: string;
    rate: string;
    taxable: string;
    billingYear: number | null;
  }>;
  payments: Array<{
    paymentId: string;
    mode: string;
    paymentDate: string;
    reference: string | null;
    status: string;
    amount: string;
    receiptNo: string | null;
  }>;
  tds: Array<{
    id: string;
    amount: string;
    section: string;
    deductionDate: string;
    certificateStatus: string;
    certificateUploaded: boolean;
    enteredByClient: boolean;
    verified: boolean;
    note: string | null;
  }>;
  creditNotes: Array<{ id: string; number: string; date: string; total: string; reason: string; pdfReady: boolean }>;
}

export interface AdminPayment {
  id: string;
  clientId: string;
  clientName: string;
  mode: string;
  amount: string;
  paymentDate: string;
  reference: string | null;
  bank: string | null;
  chequeDate: string | null;
  status: string;
  source: string;
  method: string | null;
  gatewayFee: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  remarks: string | null;
  overrideReason: string | null;
  clearedAt: string | null;
  bouncedAt: string | null;
  bounceReason: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
  proofUploaded: boolean;
  createdAt: string;
  receiptId: string | null;
  receiptNo: string | null;
  allocations?: Array<{ invoiceId: string; invoiceNo: string | null; amount: string }>;
}
export interface AdminNotification {
  id: string;
  clientId: string;
  clientName: string;
  invoiceId: string;
  invoiceNo: string;
  amount: string;
  paidOn: string;
  reference: string;
  proofUploaded: boolean;
  status: 'pending' | 'verified' | 'rejected';
  note: string | null;
  createdAt: string;
}
export interface AdminTds {
  id: string;
  clientId: string;
  clientName: string;
  invoiceId: string;
  invoiceNo: string;
  amount: string;
  section: string;
  deductionDate: string;
  certificateStatus: 'pending' | 'received';
  certificateUploaded: boolean;
  enteredByClient: boolean;
  verified: boolean;
  note: string | null;
}

export interface UsageRow {
  clientId: string;
  clientName: string;
  plantId: string;
  plantName: string;
  snapDate: string;
  activeUsers: number;
  maxUsers: number;
  storageBytes: number;
  storageGb: number;
  logsheets7d: number;
  logsheets30d: number;
  lastLogsheetDate: string | null;
  lastLoginAt: string | null;
  setupStatus: string;
  accountState: string;
  flags: { noLogsheet3d: boolean; nearUserLimit: boolean; nearStorageLimit: boolean; inactiveClient: boolean };
}

export interface AdminDashboard {
  fy: string;
  clients: { total: number; byState: Record<string, number> };
  plants: { total: number; byTerm: Record<string, number>; byType: Record<string, number> };
  money: {
    billed: string;
    collected: string;
    outstanding: string;
    overdue: string;
    tdsReceivable: string;
    creditNotes: string;
  };
  dueSoon: Record<'d30' | 'd60' | 'd90', { count: number; amount: string }>;
  endingSoon: Record<'d30' | 'd60' | 'd90', { subscriptions: number; omContracts: number; registerDocuments: number }>;
  collectionsTrend: Array<{ month: string; amount: string }>;
  recentActivity: Array<{
    id: string;
    at: string;
    actorType: string;
    action: string;
    entity: string;
    entityId: string | null;
    clientName: string | null;
  }>;
  usage: { submittedYesterday: number; livePlants: number; noSubmission3d: number };
  actions: {
    chequesPending: number;
    paymentsNeedingReview: number;
    paymentNotifications: number;
    plantRequests: number;
    failedEmails: number;
    stateChangesNext7Days: number;
    failedJobs7d: number | unknown;
  };
}
export interface ActionList {
  chequesPending: Array<{
    id: string;
    clientId: string;
    clientName: string;
    amount: string;
    reference: string | null;
    bank: string | null;
    paymentDate: string;
  }>;
  paymentsNeedingReview: Array<{
    id: string;
    clientId: string;
    clientName: string;
    amount: string;
    reference: string | null;
    reviewNote: string | null;
    paymentDate: string;
  }>;
  paymentNotifications: Array<{
    id: string;
    clientId: string;
    clientName: string;
    amount: string;
    reference: string;
    paidOn: string;
  }>;
  stateChangesNext7Days: Array<{
    clientId: string;
    clientName: string;
    plantId: string;
    plantName: string;
    from: string;
    to: string;
    on: string;
  }>;
  plantRequests: Array<{ id: string; clientId: string; clientName: string; details: unknown; createdAt: string }>;
  failedEmails: Array<{
    id: string;
    clientId: string | null;
    templateCode: string;
    to: string[];
    error: string | null;
    createdAt: string;
  }>;
  webhookErrors: Array<{ eventId: string; eventType: string; error: string; receivedAt: string }>;
}

export interface AdminAuditRow {
  id: string;
  at: string;
  clientId: string | null;
  clientName: string | null;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  actingAsAdminId: string | null;
  actingAsAdminName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
}

export interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  status: 'invited' | 'active' | 'disabled';
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface ClientUser {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  designation: string | null;
  isClientAdmin: boolean;
  status: string;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  plantRoles: Array<{ plantId: string; plantName: string; role: string }>;
}
export interface LifecycleEvent {
  id: string;
  plantId: string | null;
  plantName: string | null;
  from: string;
  to: string;
  cause: string;
  note: string | null;
  actorType: string;
  at: string;
}
export interface ClientDocument {
  id: string;
  docType: string;
  title: string;
  docDate: string | null;
  remarks: string | null;
  createdAt: string;
}
export interface ActAsSession {
  id: string;
  mode: 'view' | 'edit';
  reason: string | null;
  superAdminName: string | null;
  usedAt: string | null;
  startedAt: string;
  endedAt: string | null;
}
