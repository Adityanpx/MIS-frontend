/**
 * The ONE place that talks HTTP. Two instances exist: clientApi (/api/v1) and adminApi (/api/admin/v1).
 *
 * Security rules implemented here (TRD §7.3 / §8.3):
 *  - the access token lives ONLY in this closure (memory). Never localStorage/sessionStorage/cookies.
 *  - the refresh token is an httpOnly cookie the browser sends to …/auth/refresh (credentials: 'include').
 *  - 401 TOKEN_EXPIRED → ONE shared refresh (single in-flight promise for all parallel calls) → retry once.
 *  - any other 401 → session lost → the auth provider signs the user out.
 *  - the tenant is never sent by the browser: the API derives it from the token.
 */
import { newId } from '@/lib/utils';
import { ApiError, SESSION_LOST_CODES } from './errors';

type QueryValue = string | number | boolean | null | undefined | ReadonlyArray<string | number>;
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  query?: Query;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** true = generate a key; string = use it (keep the same key when the user retries the same action). */
  idempotencyKey?: string | true;
  /** internal */
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  [k: string]: unknown;
}
export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface ApiEvents {
  /** A refresh (proactive or after TOKEN_EXPIRED) produced a new session payload. */
  onSession?: (data: unknown) => void;
  /** The session is over (revoked, invalid, act-as ended). */
  onAuthLost?: (code: string) => void;
  /** HTTP 423: the account/plant is read-only, suspended or terminated. */
  onAccountState?: (err: ApiError) => void;
  /** 403 TERMS_NOT_ACCEPTED (Client Admin must accept the current Terms). */
  onTermsRequired?: () => void;
}

export interface ApiClient {
  readonly name: 'client' | 'admin';
  setToken(token: string | null): void;
  getToken(): string | null;
  /** false while an act-as session is active (act-as tokens can't be refreshed). */
  setRefreshEnabled(on: boolean): void;
  setEvents(e: ApiEvents): void;
  /** Uses the refresh cookie. Resolves to the new session payload, or null when there is no valid session. */
  refresh(): Promise<unknown | null>;
  get<T>(path: string, opts?: RequestOptions): Promise<T>;
  list<T>(path: string, query?: Query, opts?: RequestOptions): Promise<Paged<T>>;
  post<T = void>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  put<T = void>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  patch<T = void>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  del<T = void>(path: string, opts?: RequestOptions): Promise<T>;
  /** multipart/form-data (logos, proofs, TDS certificates, imports). */
  upload<T>(path: string, form: FormData, opts?: RequestOptions): Promise<T>;
  /**
   * File download: handles both API styles —
   *  a) JSON `{ url }` (signed R2 URL) → opened in a new tab
   *  b) a streamed file (Excel/PDF export) → saved with the server's file name
   */
  download(
    path: string,
    opts?: RequestOptions & { fallbackName?: string; method?: 'GET' | 'POST'; body?: unknown },
  ): Promise<void>;
}

const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const RETRY_BACKOFF = [600, 1500, 3000, 5000];
const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createApiClient(cfg: { name: 'client' | 'admin'; baseUrl: string; refreshPath: string }): ApiClient {
  let token: string | null = null;
  let refreshEnabled = true;
  let refreshing: Promise<unknown | null> | null = null;
  let events: ApiEvents = {};

  function url(path: string, query?: Query): string {
    const u = `${cfg.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    if (!query) return u;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, Array.isArray(v) ? v.join(',') : String(v));
    }
    const s = qs.toString();
    return s ? `${u}?${s}` : u;
  }

  async function send(
    method: string,
    path: string,
    opts: RequestOptions & { json?: unknown; form?: FormData },
    attempt = 0,
  ): Promise<Response> {
    const headers = new Headers(opts.headers);
    headers.set('Accept', 'application/json');
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.json !== undefined) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(opts.json);
    }
    if (!opts.skipAuth && token) headers.set('Authorization', `Bearer ${token}`);
    if (opts.idempotencyKey)
      headers.set('Idempotency-Key', opts.idempotencyKey === true ? newId() : opts.idempotencyKey);

    // Only retry-safe requests: GETs, auth calls, or explicitly idempotent writes.
    const canRetry = method === 'GET' || path.includes('/auth/') || !!opts.idempotencyKey;

    for (let tryNo = 0; ; tryNo++) {
      let res: Response;
      try {
        res = await fetch(url(path, opts.query), {
          method,
          headers,
          body,
          credentials: 'include',
          cache: 'no-store',
          signal: opts.signal,
        });
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') throw e;
        if (canRetry && tryNo < RETRY_BACKOFF.length) { await sleepMs(RETRY_BACKOFF[tryNo]); continue; }
        throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server.');
      }

      if (res.ok) return res;

      // Transient gateway errors: retry silently before surfacing to the user.
      if (TRANSIENT_STATUSES.has(res.status) && canRetry && tryNo < RETRY_BACKOFF.length) {
        await sleepMs(RETRY_BACKOFF[tryNo]);
        continue;
      }

      const payload = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string; details?: Record<string, unknown>; requestId?: string };
      } | null;
      const e = payload?.error;
      const err = new ApiError(
        res.status,
        e?.code ?? `HTTP_${res.status}`,
        e?.message ?? res.statusText,
        e?.details,
        e?.requestId,
      );

      if (res.status === 401 && err.code === 'TOKEN_EXPIRED' && !opts.skipRefresh && attempt === 0) {
        const fresh = await refresh();
        if (fresh) return send(method, path, opts, 1);
        events.onAuthLost?.('TOKEN_EXPIRED');
        throw err;
      }
      if (res.status === 401 && !opts.skipAuth && (SESSION_LOST_CODES as readonly string[]).includes(err.code)) {
        events.onAuthLost?.(err.code);
      }
      if (res.status === 423) events.onAccountState?.(err);
      if (res.status === 403 && err.code === 'TERMS_NOT_ACCEPTED') events.onTermsRequired?.();
      throw err;
    }
  }

  async function json<T>(res: Response): Promise<{ data: T; meta?: PageMeta }> {
    if (res.status === 204) return { data: undefined as T };
    const body = (await res.json().catch(() => ({}))) as { data?: T; meta?: PageMeta };
    return { data: body.data as T, meta: body.meta };
  }

  async function refresh(): Promise<unknown | null> {
    if (!refreshEnabled) return null;
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const res = await send('POST', cfg.refreshPath, { skipAuth: true, skipRefresh: true });
          const { data } = await json<{ accessToken?: string }>(res);
          token = data?.accessToken ?? null;
          if (!token) return null;
          events.onSession?.(data);
          return data as unknown;
        } catch {
          token = null;
          return null;
        }
      })().finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  const call = async <T>(method: string, path: string, body: unknown, opts: RequestOptions = {}) =>
    (await json<T>(await send(method, path, { ...opts, json: body }))).data;

  function fileName(res: Response, fallback: string): string {
    const cd = res.headers.get('Content-Disposition') ?? '';
    const star = /filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1];
    if (star) return decodeURIComponent(star);
    return /filename="?([^";]+)"?/i.exec(cd)?.[1] ?? fallback;
  }

  return {
    name: cfg.name,
    setToken: (t) => {
      token = t;
    },
    getToken: () => token,
    setRefreshEnabled: (on) => {
      refreshEnabled = on;
    },
    setEvents: (e) => {
      events = e;
    },
    refresh,
    get: (path, opts) => call('GET', path, undefined, opts),
    async list<T>(path: string, query?: Query, opts?: RequestOptions) {
      const r = await json<T[]>(await send('GET', path, { ...opts, query: { ...opts?.query, ...query } }));
      const items = Array.isArray(r.data) ? r.data : [];
      return { items, meta: r.meta ?? { page: 1, pageSize: items.length, total: items.length } };
    },
    post: (path, body, opts) => call('POST', path, body, opts),
    put: (path, body, opts) => call('PUT', path, body, opts),
    patch: (path, body, opts) => call('PATCH', path, body, opts),
    del: (path, opts) => call('DELETE', path, undefined, opts),
    upload: async (path, form, opts) => (await json(await send('POST', path, { ...opts, form }))).data as never,
    async download(path, opts = {}) {
      const res = await send(opts.method ?? 'GET', path, { ...opts, json: opts.body });
      const type = res.headers.get('Content-Type') ?? '';
      if (type.includes('application/json')) {
        const { data } = await json<{ url?: string; downloadUrl?: string }>(res);
        const target = data?.url ?? data?.downloadUrl;
        if (!target) throw new ApiError(500, 'NO_DOWNLOAD_URL', 'The file is not available yet.');
        window.open(target, '_blank', 'noopener,noreferrer');
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName(res, opts.fallbackName ?? 'download');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
    },
  };
}
