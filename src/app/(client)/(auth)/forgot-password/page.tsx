'use client';

import { ForgotForm } from '@/components/auth/forms';
import { useClientAuth } from '@/lib/auth/client-auth';

export default function ForgotPasswordPage() {
  return <ForgotForm auth={useClientAuth()} base="" />;
}
