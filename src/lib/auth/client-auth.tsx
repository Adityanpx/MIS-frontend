'use client';

import { clientApi } from '@/lib/api';
import { createAuth } from './create-auth';
import type { ClientProfile } from './types';

const auth = createAuth<ClientProfile>({
  area: 'client',
  api: clientApi,
  toProfile: (d) => d as unknown as ClientProfile,
  paths: { login: '/login', home: '/' },
  // the act-as page exchanges its one-time code itself; it must not pick up a real user's refresh cookie
  skipBootstrapOn: ['/act-as'],
  onTermsRequired: (router) => router.replace('/accept-terms'),
});

export const ClientAuthProvider = auth.Provider;
export const useClientAuth = auth.useAuth;
