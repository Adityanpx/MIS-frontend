'use client';

import { useParams } from 'next/navigation';
import { ResetForm } from '@/components/auth/forms';
import { useAdminAuth } from '@/lib/auth/admin-auth';

export default function AdminResetPage() {
  const { token } = useParams<{ token: string }>();
  return <ResetForm auth={useAdminAuth()} base="/admin" token={token} />;
}
