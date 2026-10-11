'use client';

import { EnrolForm } from '@/components/auth/forms';
import { useClientAuth } from '@/lib/auth/client-auth';

export default function EnrolPage() {
  return <EnrolForm auth={useClientAuth()} base="" />;
}
