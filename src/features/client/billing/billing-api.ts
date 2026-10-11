'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { qk } from '@/lib/query/keys';

/** Shapes of /api/v1/billing/* (backend Phase 3 client-billing.routes.ts). Money = strings with 2 decimals. */
export type InvoiceStatus = 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'written_off';
export interface Invoice {
  id: string;
  number: string | null;
  fy: string | null;
  kind: string;
  plants: string | null;
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
  movedToCredit: string;
  writtenOff: string;
  balance: string;
  status: InvoiceStatus;
  pdfReady: boolean;
  payUrl: string | null;
  payUrlExpiresAt: string | null;
  notes: string | null;
  cancelReason: string | null;
  createdAt: string;
}
/** Note: in the detail the API's `tds` key is the LIST of TDS entries (it replaces the invoice's TDS total). */
export interface InvoiceDetail extends Omit<Invoice, 'tds'> {
  lines: Array<{
    id: string;
    plantId: string | null;
    billingYear: number | null;
    description: string;
    sac: string | null;
    qty: string;
    rate: string;
    taxable: string;
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
export interface Payment {
  id: string;
  mode: string;
  amount: string;
  paymentDate: string;
  reference: string | null;
  status: 'pending_clearance' | 'applied' | 'bounced' | 'reversed';
  receiptId: string | null;
  receiptNo: string | null;
  receiptReady: boolean;
  /** amounts come from json_build_object → JSON numbers; invoiceNo null = kept as advance */
  allocations: Array<{ invoiceNo: string | null; amount: number }> | null;
}
export interface PaymentNotification {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  amount: string;
  paidOn: string;
  reference: string;
  status: 'pending' | 'verified' | 'rejected';
  note: string | null;
  createdAt: string;
}
export interface PlantSubscription {
  plantId: string;
  plantName: string;
  plantCode: string;
  accountState: string;
  setupStatus: string;
  subscription: {
    id: string;
    planName: string;
    termYears: number;
    startDate: string;
    endDate: string;
    billingMode: 'yearly' | 'upfront';
    status: string;
    pricePerYear: string;
    totalExGst: string;
    schedule: Array<{
      id: string;
      yearNo: number;
      periodFrom: string;
      periodTo: string;
      amount: string;
      plannedInvoiceDate: string;
      dueDate: string;
      invoiceId: string | null;
      status: 'invoiced' | 'planned';
    }>;
  } | null;
}
export interface Credit {
  balance: string;
  ledger: Array<{ date: string; kind: string; amount: string; refType: string | null }>;
}

/** /billing/* is Client Admin only (403 for everyone else) — other roles never call it. */
const useSignedIn = () => {
  const a = useClientAuth();
  return a.status === 'authenticated' && !!a.profile?.user.isClientAdmin;
};
const BASE = '/billing';

/** GET /billing/summary lives in File 1 (`useBillingSummary` in ../queries — also used by the sidebar card). */
/** Seller bank details from Settings → Company (empty strings when not set). */
export interface BankDetails {
  accountName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
}
export const useInvoices = (query: { status?: string; q?: string; page: number; pageSize: number }) =>
  useQuery({
    queryKey: qk.client.billing('invoices', query),
    queryFn: () => clientApi.list<Invoice>(`${BASE}/invoices`, query),
    enabled: useSignedIn(),
    placeholderData: keepPreviousData,
  });
export const useInvoice = (id: string) =>
  useQuery({
    queryKey: qk.client.invoice(id),
    queryFn: () => clientApi.get<InvoiceDetail>(`${BASE}/invoices/${id}`),
    enabled: useSignedIn(),
  });
export const usePayments = () =>
  useQuery({
    queryKey: qk.client.billing('payments'),
    queryFn: () => clientApi.get<Payment[]>(`${BASE}/payments`),
    enabled: useSignedIn(),
  });
export const useNotifications = () =>
  useQuery({
    queryKey: qk.client.billing('notifications'),
    queryFn: () => clientApi.get<PaymentNotification[]>(`${BASE}/payment-notifications`),
    enabled: useSignedIn(),
  });
export const useSubscriptions = () =>
  useQuery({
    queryKey: qk.client.billing('subscriptions'),
    queryFn: () => clientApi.get<PlantSubscription[]>(`${BASE}/subscriptions`),
    enabled: useSignedIn(),
  });
export const useCredit = () =>
  useQuery({
    queryKey: qk.client.billing('credit'),
    queryFn: () => clientApi.get<Credit>(`${BASE}/credit`),
    enabled: useSignedIn(),
  });

/** Signed URL documents (invoice / receipt / credit note PDFs); PDF_NOT_READY → friendly toast. */
export async function openBillingPdf(path: string) {
  try {
    await clientApi.download(`${BASE}${path}`);
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

/** CA-10: Razorpay pay link for the current balance — opened in the same tab so the payment page is not blocked. */
export async function payNow(invoiceId: string) {
  try {
    const { url } = await clientApi.post<{ url: string }>(`${BASE}/invoices/${invoiceId}/pay-link`);
    window.location.assign(url);
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

/** TDS sections allowed by default (Settings → Tax); the API answers TDS_SECTION_UNKNOWN with the real list. */
export const TDS_SECTIONS = ['194J', '194C'];

/** What the pay / TDS dialogs need from an invoice (list row or detail). */
export type InvoiceRef = Pick<Invoice, 'id' | 'number' | 'balance' | 'taxable' | 'total' | 'status' | 'pdfReady'>;

export const OPEN_STATUSES: InvoiceStatus[] = ['issued', 'partially_paid', 'overdue'];
