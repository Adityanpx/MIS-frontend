'use client';

import { LoginForm } from '@/components/auth/forms';
import { useClientAuth } from '@/lib/auth/client-auth';

export default function LoginPage() {
  const auth = useClientAuth();
  return (
    <LoginForm auth={auth} base="" title="Welcome back" subtitle="Sign in to your plant MIS with your work email." />
  );
}
