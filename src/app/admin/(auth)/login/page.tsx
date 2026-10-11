'use client';

import { LoginForm } from '@/components/auth/forms';
import { useAdminAuth } from '@/lib/auth/admin-auth';

export default function AdminLoginPage() {
  return (
    <LoginForm
      auth={useAdminAuth()}
      base="/admin"
      title="Super Admin sign in"
      subtitle="Two-step verification is required for every Super Admin."
    />
  );
}
