/** Public configuration (inlined at build time by Next). Never put secrets in NEXT_PUBLIC_* variables. */
const strip = (s: string | undefined) => (s ?? '').trim().replace(/\/$/, '');

export const env = {
  /** '' = proxy mode: call /api/* on this site (next.config.ts rewrites it to the API). */
  apiOrigin: strip(process.env.NEXT_PUBLIC_API_URL),
  appName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'OMMIS',
  appEnv: process.env.NEXT_PUBLIC_APP_ENV?.trim() || 'local',
  idleMinutes: Number(process.env.NEXT_PUBLIC_IDLE_MINUTES ?? 30) || 30,
} as const;

export const CLIENT_API_BASE = `${env.apiOrigin}/api/v1`;
export const ADMIN_API_BASE = `${env.apiOrigin}/api/admin/v1`;
