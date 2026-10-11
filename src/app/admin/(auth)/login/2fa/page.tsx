'use client';

import { TwoFactorForm } from '@/components/auth/forms';
import { useAdminAuth } from '@/lib/auth/admin-auth';

export default function AdminTwoFactorPage() {
  return <TwoFactorForm auth={useAdminAuth()} base="/admin" />;
}
