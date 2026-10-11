'use client';

import { EnrolForm } from '@/components/auth/forms';
import { useAdminAuth } from '@/lib/auth/admin-auth';

export default function AdminEnrolPage() {
  return <EnrolForm auth={useAdminAuth()} base="/admin" />;
}
