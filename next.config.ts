import type { NextConfig } from 'next';

/**
 * Two ways to reach the API (see .env.example):
 *  - PROXY mode (recommended): NEXT_PUBLIC_API_URL is empty, API_PROXY_TARGET is the API origin.
 *    The browser calls /api/* on THIS site and Next forwards it, so the refresh cookie is first-party
 *    (SameSite=Lax works, nothing is blocked as a third-party cookie).
 *  - DIRECT mode: NEXT_PUBLIC_API_URL is the API origin (needs COOKIE_SAMESITE=none + COOKIE_SECURE=true on the API).
 */
const PROXY_TARGET = (process.env.API_PROXY_TARGET ?? '').replace(/\/$/, '');
const DIRECT_API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const isDev = process.env.NODE_ENV !== 'production';

const apiOrigins = [DIRECT_API, PROXY_TARGET].filter(Boolean).join(' ');
const r2 = 'https://*.r2.cloudflarestorage.com';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${r2} ${apiOrigins}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigins}${isDev ? ' ws: http://localhost:*' : ''}`.trim(),
  `frame-src 'self' blob: ${r2} ${apiOrigins}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    if (!PROXY_TARGET) return [];
    return [
      { source: '/api/:path*', destination: `${PROXY_TARGET}/api/:path*` },
      // wake-up ping from the login page (a sleeping host starts booting before the user clicks Sign in)
      { source: '/health', destination: `${PROXY_TARGET}/health` },
      // signed local-storage files (STORAGE_DRIVER=local on the API) when PUBLIC_API_URL points at this site
      { source: '/files/:path*', destination: `${PROXY_TARGET}/files/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
