/** Response shapes of client endpoints used by the shell (mirrors the backend handoff). Later files add more. */

/** GET /api/v1/plants (list) and GET /api/v1/plants/:plantId (detail adds contractYears, subscription, users). */
export interface PlantSummary {
  id: string;
  code: string;
  name: string;
  type: string;
  capacityMld: number;
  city: string | null;
  stateCode: string;
  omStart: string;
  omEnd: string;
  misStart: string;
  setupStatus: 'settings_pending' | 'live' | 'closed';
  accountState: 'active' | 'grace' | 'read_only' | 'suspended' | 'terminated' | 'expired';
  myRole: 'client_admin' | 'editor' | 'checker' | 'verifier' | 'viewer';
  subscriptionEnd: string | null;
}

export interface PlantDetail extends PlantSummary {
  contractYears: Array<{ yearNo: number; startDate: string; endDate: string; days: number; feeConfigured: boolean }>;
  /** Client Admin only */
  subscription?: {
    planName: string;
    termYears: number;
    startDate: string;
    endDate: string;
    billingMode: 'yearly' | 'upfront';
    status: string;
    features: Record<string, unknown> | string[] | null;
  } | null;
  /** Client Admin only */
  users?: { used: number; limit: number } | null;
}

/** GET /api/v1/banners (Phase 3 §17.2) — one per plant that is not active. */
export interface LifecycleBannerDto {
  plantId: string;
  plantName: string;
  state: 'grace' | 'read_only' | 'expired' | 'suspended' | 'terminated';
  level: 'yellow' | 'orange' | 'red';
  message: string;
  overdueAmount: string | null;
  overdueSince: string | null;
  nextChange: { state: string; on: string } | null;
  showPayNow: boolean;
}

/** GET /api/v1/billing/summary (Client Admin). */
export interface BillingSummary {
  outstanding: string;
  overdue: string;
  nextDue: string | null;
  creditBalance: string;
  accountState: string;
  paymentInstructions: { payee: string; bank: unknown; upiId: string | null; note: string };
}
