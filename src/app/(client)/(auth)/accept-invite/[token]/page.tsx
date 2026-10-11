'use client';

import { useParams } from 'next/navigation';
import { InviteForm } from '@/components/auth/forms';
import { useClientAuth } from '@/lib/auth/client-auth';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  return <InviteForm auth={useClientAuth()} base="" token={token} />;
}
