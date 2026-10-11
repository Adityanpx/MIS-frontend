import { ADMIN_API_BASE, CLIENT_API_BASE } from '@/lib/env';
import { createApiClient } from './http';

/** Client app API (/api/v1). Use ONLY inside the client area (src/app/(client), src/features/client). */
export const clientApi = createApiClient({ name: 'client', baseUrl: CLIENT_API_BASE, refreshPath: '/auth/refresh' });

/** Super Admin API (/api/admin/v1). Use ONLY inside src/app/admin and src/features/admin. */
export const adminApi = createApiClient({ name: 'admin', baseUrl: ADMIN_API_BASE, refreshPath: '/auth/refresh' });

export { ApiError, errorMessage, fieldErrors, hasCode, isApiError } from './errors';
export type { ApiClient, Paged, PageMeta, Query, RequestOptions } from './http';
