'use client';

import { ForgotForm } from '@/components/auth/forms';
import { useAdminAuth } from '@/lib/auth/admin-auth';

export default function AdminForgotPage() {
  return <ForgotForm auth={useAdminAuth()} base="/admin" />;
}
