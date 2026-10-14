import { safeNext } from '@/lib/utils';
import type { ClientProfile, PlantAccess } from './types';

const LAST_PLANT_KEY = (userId: string) => `ommis.lastPlant.${userId}`;

export function rememberPlant(userId: string, plantId: string): void {
  try {
    localStorage.setItem(LAST_PLANT_KEY(userId), plantId);
  } catch {
    /* ignore */
  }
}

/** The plant to open by default: the last one used on this device, else the first live plant, else the first. */
export function defaultPlant(p: ClientProfile): PlantAccess | null {
  let last: string | null = null;
  try {
    last = localStorage.getItem(LAST_PLANT_KEY(p.user.id));
  } catch {
    /* ignore */
  }
  const open = p.plants.filter((x) => x.setupStatus !== 'closed');
  return open.find((x) => x.plantId === last) ?? open.find((x) => x.setupStatus === 'live') ?? open[0] ?? null;
}

/** Where a gate sends this user, or null when the user may use the app normally. */
export function gateFor(p: ClientProfile, pathname: string): string | null {
  if (p.actingAs) return null; // support sessions skip the gates
  if (p.mustAcceptTerms) return pathname === '/accept-terms' ? null : '/accept-terms';
  const state = p.tenant.accountState;
  const billingOrExport = pathname.startsWith('/billing') || pathname.startsWith('/company/export');
  if (state === 'terminated') {
    if (p.user.isClientAdmin) return billingOrExport || pathname === '/terminated' ? null : '/terminated';
    return pathname === '/suspended' ? null : '/suspended';
  }
  if (state === 'suspended') {
    if (p.user.isClientAdmin) return billingOrExport || pathname === '/profile' ? null : '/billing';
    return pathname === '/suspended' ? null : '/suspended';
  }
  return null;
}

/**
 * PRD AUTH-09 landing page after sign-in:
 *  Management        → /company/portfolio
 *  Client Admin      → overview (/)
 *  Editor            → logsheet of the default plant
 *  Checker/Verifier/Viewer → dashboard
 */
export function landingPath(p: ClientProfile, next?: string | null): string {
  const gate = gateFor(p, '');
  if (gate) return gate;
  const target = safeNext(next, 'client');
  if (target && !['/login', '/act-as'].some((x) => target.startsWith(x))) return target;
  if (p.user.isManagement) return '/company/portfolio';
  if (p.user.isClientAdmin) return '/';
  const plant = defaultPlant(p);
  if (!plant) return '/';
  if (plant.role === 'editor') return `/plants/${plant.plantId}/logsheet`;
  return `/plants/${plant.plantId}/dashboard`;
}
