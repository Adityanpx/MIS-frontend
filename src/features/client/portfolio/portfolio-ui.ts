import {
  Building2,
  ClipboardList,
  Database,
  FlaskConical,
  ShieldCheck,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { IssueCategory, PlantHealth, PortfolioIssue, PortfolioRow } from '../engine-types';

/** Areas the system-detected issues are grouped into (same order as the MIS tabs). */
export const CATEGORY_META: Record<IssueCategory, { label: string; icon: LucideIcon }> = {
  logsheet: { label: 'Logsheet', icon: ClipboardList },
  compliance: { label: 'Compliance', icon: ShieldCheck },
  chemicals: { label: 'Chemicals', icon: FlaskConical },
  admin: { label: 'Administrative', icon: UsersRound },
  maintenance: { label: 'Maintenance', icon: Wrench },
  account: { label: 'Account', icon: Building2 },
  data: { label: 'Data', icon: Database },
};
export const CATEGORY_ORDER = Object.keys(CATEGORY_META) as IssueCategory[];

export const HEALTH_META: Record<PlantHealth, { label: string; dot: string; ring: string }> = {
  critical: { label: 'Critical', dot: 'bg-danger-500', ring: 'ring-danger-500/20' },
  warning: { label: 'Needs attention', dot: 'bg-warning-500', ring: 'ring-warning-500/20' },
  ok: { label: 'Healthy', dot: 'bg-success-400', ring: 'ring-success-400/25' },
  inactive: { label: 'Not reporting', dot: 'bg-ink-300', ring: 'ring-ink-300/30' },
};

export const STANDARD_LABEL = {
  primary: 'Primary standard',
  actual: 'Actual standard',
  bidding: 'Bidding standard',
} as const;

/** Logsheet states the backend adds on top of the normal logsheet statuses. */
export const EXTRA_LOGSHEET: Record<'not_due' | 'not_live' | 'unavailable', string> = {
  not_due: 'Not due',
  not_live: 'Not live',
  unavailable: 'Unavailable',
};

/**
 * Where an issue is fixed. Logsheet and billing pages are only offered to a Client Admin; a Management user
 * (company-wide, read-only) is sent to the plant's MIS / dashboard instead.
 */
export function issueHref(i: PortfolioIssue, date: string, isClientAdmin: boolean): string | null {
  const base = `/plants/${i.plantId}`;
  switch (i.category) {
    case 'logsheet':
      return isClientAdmin ? `${base}/logsheet/${date}` : `${base}/dashboard/${date}`;
    case 'maintenance':
      return `${base}/maintenance`;
    case 'account':
      return isClientAdmin ? '/billing' : null;
    case 'data':
      return `${base}/dashboard/${date}`;
    default:
      return `${base}/mis/${date}`;
  }
}

/** A plant's pages can be opened once it is live and its account is not suspended / terminated. */
export const canOpenPlant = (r: Pick<PortfolioRow, 'setupStatus' | 'accountState'>) =>
  r.setupStatus === 'live' && !['suspended', 'terminated'].includes(r.accountState);

/** Sort weight for "most urgent first". */
export const urgency = (r: PortfolioRow) => r.issues.critical * 1000 + r.issues.warning;
