'use client';

import { useParams } from 'next/navigation';
import { ResetForm } from '@/components/auth/forms';
import { useClientAuth } from '@/lib/auth/client-auth';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  return <ResetForm auth={useClientAuth()} base="" token={token} />;
}
