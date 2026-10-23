'use client';

import { useEffect } from 'react';
import { LoginForm } from '@/components/auth/forms';
import { useClientAuth } from '@/lib/auth/client-auth';

export default function LoginPage() {
  const auth = useClientAuth();
  // Wake a sleeping API host while the user types; the response is irrelevant.
  useEffect(() => {
    fetch('/health', { cache: 'no-store' }).catch(() => {});
  }, []);
  return (
    <LoginForm auth={auth} base="" title="Welcome back" subtitle="Sign in to your plant MIS with your work email." />
  );
}
