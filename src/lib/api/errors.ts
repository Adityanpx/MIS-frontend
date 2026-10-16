/**
 * Every failed API call throws ApiError. The backend already sends readable messages
 * ({ error: { code, message, details, requestId } }), so the UI shows `message` and only
 * overrides the few cases where a friendlier text helps.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
export const hasCode = (e: unknown, ...codes: string[]) => isApiError(e) && codes.includes(e.code);

/** Codes that mean "the session is over — sign in again". */
export const SESSION_LOST_CODES = ['TOKEN_REVOKED', 'TOKEN_INVALID', 'UNAUTHENTICATED', 'ACT_AS_ENDED'] as const;
/** Account-state gates (HTTP 423). The UI shows the banner text and disables writes. */
export const ACCOUNT_STATE_CODES = ['ACCOUNT_READ_ONLY', 'ACCOUNT_SUSPENDED', 'ACCOUNT_TERMINATED'] as const;

const OVERRIDES: Record<string, string> = {
  NETWORK_ERROR: 'Cannot reach the server. Check your internet connection and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again in a moment.',
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  ROUTE_NOT_FOUND: 'This feature is not available on the server yet.',
  ORIGIN_NOT_ALLOWED: 'This site is not allowed to talk to the API (check CORS_ORIGINS on the API).',
  STALE_VERSION: 'Someone else saved this in the meantime. Reload to see the latest version.',
  ACT_AS_READ_ONLY: 'This support session is read-only.',
  HTTP_502: 'The server is starting up. Please wait a few seconds and try again.',
  HTTP_503: 'The server is starting up. Please wait a few seconds and try again.',
  HTTP_504: 'The server is starting up. Please wait a few seconds and try again.',
};

/** The text to show in a toast or under a form. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (isApiError(e)) return OVERRIDES[e.code] ?? (e.message || fallback);
  if (e instanceof Error && e.name === 'AbortError') return 'The request was cancelled.';
  return fallback;
}

/**
 * Field errors for React Hook Form:
 *  - VALIDATION_FAILED → details.issues[{ path, message }]
 *  - business errors that name a field → details.field (e.g. WEAK_PASSWORD → 'password')
 */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!isApiError(e) || !e.details) return {};
  const out: Record<string, string> = {};
  const issues = e.details.issues;
  if (Array.isArray(issues)) {
    for (const i of issues as Array<{ path?: string; message?: string }>) {
      if (i.path && i.message && !out[i.path]) out[i.path] = i.message;
    }
  }
  const field = e.details.field;
  if (typeof field === 'string') out[field] = e.message;
  return out;
}
