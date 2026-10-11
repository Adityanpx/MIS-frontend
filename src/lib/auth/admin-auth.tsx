'use client';

import { adminApi } from '@/lib/api';
import { createAuth } from './create-auth';
import type { AdminProfile } from './types';

const auth = createAuth<AdminProfile>({
  area: 'admin',
  api: adminApi,
  toProfile: (d) => ({ admin: (d.admin ?? d) as AdminProfile['admin'] }),
  paths: { login: '/admin/login', home: '/admin' },
});

export const AdminAuthProvider = auth.Provider;
export const useAdminAuth = auth.useAuth;
