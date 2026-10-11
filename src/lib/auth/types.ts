import type { PlantRole } from '@/shared/enums';

/** Mirrors backend src/modules/auth/session.ts → SessionProfile. */
export type MyPlantRole = PlantRole | 'client_admin';

export interface PlantAccess {
  plantId: string;
  code: string;
  name: string;
  role: MyPlantRole;
  setupStatus: 'settings_pending' | 'live' | 'closed' | string;
  accountState: 'active' | 'grace' | 'read_only' | 'suspended' | 'terminated' | 'expired' | string;
}

export interface ClientProfile {
  user: {
    id: string;
    name: string;
    email: string;
    mobile: string | null;
    designation: string | null;
    isClientAdmin: boolean;
    totpEnabled: boolean;
  };
  tenant: {
    id: string;
    code: string;
    displayName: string;
    accountState: string;
    force2fa: boolean;
    logoUrl: string | null;
  };
  plants: PlantAccess[];
  mustAcceptTerms: boolean;
  termsVersion: string;
  actingAs: { adminId: string; mode: 'view' | 'edit' } | null;
}

/** Mirrors backend src/modules/admin-auth/admin-session.ts → AdminProfile. */
export interface AdminProfile {
  admin: {
    id: string;
    name: string;
    email: string;
    mobile: string | null;
    totpEnabled: boolean;
    lastLoginAt: string | null;
  };
}

export interface SessionTokens {
  mfaRequired: false;
  accessToken: string;
  expiresIn: number;
}
export interface MfaChallenge {
  mfaRequired: true;
  mfaPurpose: 'verify' | 'enrol';
  mfaToken: string;
  /** TEMP TESTING (remove before go-live): the API's current code, sent only on non-production builds. */
  devCode?: string;
}
export type LoginResponse<P> = (SessionTokens & P) | MfaChallenge;

/** What the login/invite step leads to. */
export type LoginStep = 'verify' | 'enrol' | 'session';

export interface EnrolSecret {
  secret: string;
  otpauthUrl: string;
}
