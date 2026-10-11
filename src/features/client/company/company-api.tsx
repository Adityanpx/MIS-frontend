'use client';

import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { useClientAuth } from '@/lib/auth/client-auth';
import type { PlantRole } from '@/shared/enums';

/** Shapes of /api/v1/company/* (backend Phase 1 company module + Phase 3 exports). */
export interface CompanyDto {
  id: string;
  code: string;
  displayName: string;
  legalName: string;
  gstin: string | null;
  pan: string | null;
  stateCode: string;
  stateName: string;
  address: Record<string, string | undefined>;
  primaryContact: { name?: string; email?: string; mobile?: string };
  billingEmails: string[];
  logoUrl: string | null;
  force2fa: boolean;
  accountState: string;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  plantsCount: number;
  usersCount: number;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  designation: string | null;
  isClientAdmin: boolean;
  status: 'invited' | 'active' | 'disabled';
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  plantRoles: Array<{ plantId: string; plantName: string; role: PlantRole }>;
}

export interface AuditRow {
  /** bigserial → a number in JSON */
  id: number | string;
  actor: { type: string; id: string | null; name: string | null; viaSupportSession: boolean };
  action: string;
  entity: string;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  at: string;
}

/** Company, users, audit, billing and data export are Client Admin pages (the API answers 403 otherwise). */
export function ClientAdminOnly({ title, children }: { title: string; children: ReactNode }) {
  const { profile } = useClientAuth();
  if (profile && !profile.user.isClientAdmin) {
    return (
      <>
        <PageHeader title={title} />
        <Card>
          <EmptyState
            icon={<ShieldAlert />}
            title="Client Admins only"
            description="Ask your Client Admin if you need something here."
          />
        </Card>
      </>
    );
  }
  return <>{children}</>;
}
