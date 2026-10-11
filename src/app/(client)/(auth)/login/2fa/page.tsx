'use client';

import { TwoFactorForm } from '@/components/auth/forms';
import { useClientAuth } from '@/lib/auth/client-auth';

export default function TwoFactorPage() {
  return <TwoFactorForm auth={useClientAuth()} base="" />;
}
