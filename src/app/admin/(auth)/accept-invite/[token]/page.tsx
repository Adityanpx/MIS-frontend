'use client';

import { useParams } from 'next/navigation';
import { InviteForm } from '@/components/auth/forms';
import { useAdminAuth } from '@/lib/auth/admin-auth';

export default function AdminInvitePage() {
  const { token } = useParams<{ token: string }>();
  return <InviteForm auth={useAdminAuth()} base="/admin" token={token} />;
}
