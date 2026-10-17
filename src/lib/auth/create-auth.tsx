'use client';

/**
 * One implementation of "a signed-in area", used twice:
 *   createAuth({ area: 'client', … }) → ClientAuthProvider / useClientAuth   (src/lib/auth/client-auth.tsx)
 *   createAuth({ area: 'admin',  … }) → AdminAuthProvider  / useAdminAuth    (src/lib/auth/admin-auth.tsx)
 *
 * Holds: status, profile, the pending 2FA challenge (memory only), timers (proactive refresh, idle sign-out,
 * act-as expiry) and cross-tab sign-out. The access token itself is inside the ApiClient closure.
 */
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ApiClient } from '@/lib/api/http';
import { errorMessage } from '@/lib/api/errors';
import { env } from '@/lib/env';
import type { EnrolSecret, LoginResponse, LoginStep, MfaChallenge } from './types';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'ended';
export type EndReason = 'logout' | 'idle' | 'expired' | 'revoked' | 'act_as_ended' | null;

export interface AuthContextValue<P> {
  area: 'client' | 'admin';
  status: AuthStatus;
  profile: P | null;
  endReason: EndReason;
  /** pending 2FA challenge after the password step (memory only; lost on reload → back to login). */
  mfa: { token: string; purpose: 'verify' | 'enrol'; devCode?: string } | null;
  isActingAs: boolean;
  /** epoch ms when the act-as token expires (for the countdown banner). */
  actAsExpiresAt: number | null;
  paths: { login: string; home: string };
  login(email: string, password: string): Promise<LoginStep>;
  verifyMfa(code: string): Promise<P>;
  startEnrol(): Promise<EnrolSecret>;
  confirmEnrol(code: string): Promise<P>;
  acceptInvite(token: string, password: string): Promise<LoginStep>;
  forgot(email: string): Promise<string>;
  reset(token: string, password: string): Promise<string>;
  logout(reason?: EndReason): Promise<void>;
  logoutAll(): Promise<void>;
  /** Re-reads /me (after accepting terms, profile edits, role changes). */
  reloadProfile(): Promise<P | null>;
  /** Use the session payload returned by change-password or act-as exchange. */
  applySession(data: unknown, opts?: { actAs?: boolean }): P;
  setProfile(p: P): void;
}

export interface AuthConfig<P> {
  area: 'client' | 'admin';
  api: ApiClient;
  /** strip tokens off a session payload */
  toProfile(data: Record<string, unknown>): P;
  paths: { login: string; home: string };
  /** paths where the provider must NOT try the refresh cookie on start (e.g. '/act-as') */
  skipBootstrapOn?: string[];
  onTermsRequired?: (router: ReturnType<typeof useRouter>) => void;
}

const ACT_AS_MARKER = 'ommis.actAs';

export function createAuth<P>(cfg: AuthConfig<P>) {
  const Ctx = createContext<AuthContextValue<P> | null>(null);
  const channelName = `ommis-auth-${cfg.area}`;
  const queryRoot = [cfg.area === 'client' ? 'c' : 'a'];

  function Provider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const qc = useQueryClient();
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [profile, setProfileState] = useState<P | null>(null);
    const [endReason, setEndReason] = useState<EndReason>(null);
    const [mfa, setMfa] = useState<AuthContextValue<P>['mfa']>(null);
    const [actAsExpiresAt, setActAsExpiresAt] = useState<number | null>(null);
    const statusRef = useRef<AuthStatus>('loading');
    const actAsRef = useRef(false);
    const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const channel = useRef<BroadcastChannel | null>(null);

    const setStatusBoth = (s: AuthStatus) => {
      statusRef.current = s;
      setStatus(s);
    };

    const clearTimers = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    };

    /** Drop everything this area cached (other tenants' data must never survive a sign-out). */
    const wipe = useCallback(() => {
      clearTimers();
      cfg.api.setToken(null);
      qc.removeQueries({ queryKey: queryRoot });
      setProfileState(null);
      setMfa(null);
    }, [qc]);

    const end = useCallback(
      (reason: EndReason) => {
        const wasActAs = actAsRef.current;
        wipe();
        setEndReason(wasActAs && reason !== 'logout' ? 'act_as_ended' : reason);
        setStatusBoth(wasActAs ? 'ended' : 'anonymous');
      },
      [wipe],
    );

    const scheduleRefresh = useCallback((expiresInSec: number, actAs: boolean) => {
      clearTimers();
      if (actAs) {
        // act-as tokens cannot be refreshed: end the support session when the token expires
        refreshTimer.current = setTimeout(() => end('act_as_ended'), expiresInSec * 1000);
        return;
      }
      const ms = Math.max(30, expiresInSec - 60) * 1000;
      refreshTimer.current = setTimeout(async () => {
        const data = await cfg.api.refresh();
        if (!data) end('expired');
      }, ms);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applySession = useCallback(
      (raw: unknown, opts: { actAs?: boolean } = {}): P => {
        const data = raw as Record<string, unknown> & { accessToken: string; expiresIn: number };
        const actAs = !!opts.actAs || actAsRef.current;
        actAsRef.current = actAs;
        cfg.api.setToken(data.accessToken);
        cfg.api.setRefreshEnabled(!actAs);
        const { accessToken: _a, expiresIn: _e, mfaRequired: _m, ...rest } = data;
        const p = cfg.toProfile(rest);
        setProfileState(p);
        setMfa(null);
        setEndReason(null);
        setStatusBoth('authenticated');
        if (actAs) {
          try {
            sessionStorage.setItem(ACT_AS_MARKER, '1');
          } catch {
            /* private mode */
          }
          setActAsExpiresAt(Date.now() + data.expiresIn * 1000);
        }
        scheduleRefresh(data.expiresIn, actAs);
        return p;
      },
      [scheduleRefresh],
    );

    // ---- API events (refresh results, lost sessions, 423 states, terms) ----
    useEffect(() => {
      cfg.api.setEvents({
        onSession: (d) => {
          if (statusRef.current !== 'ended') applySession(d);
        },
        onAuthLost: (code) => {
          if (statusRef.current !== 'authenticated') return;
          end(code === 'ACT_AS_ENDED' ? 'act_as_ended' : code === 'TOKEN_EXPIRED' ? 'expired' : 'revoked');
          toast.error(
            code === 'ACT_AS_ENDED'
              ? 'This support session has ended.'
              : 'Your session has ended. Please sign in again.',
          );
        },
        onAccountState: (err) => {
          toast.error(err.message, { id: `state-${err.code}` });
          void qc.invalidateQueries({ queryKey: [...queryRoot, 'banners'] });
        },
        onTermsRequired: () => cfg.onTermsRequired?.(router),
      });
    }, [applySession, end, qc, router]);

    // ---- bootstrap: try the refresh cookie once ----
    const booted = useRef(false);
    useEffect(() => {
      if (booted.current) return;
      booted.current = true;
      let actAsMarker = false;
      try {
        actAsMarker = sessionStorage.getItem(ACT_AS_MARKER) === '1';
      } catch {
        /* ignore */
      }
      if (cfg.skipBootstrapOn?.some((p) => pathname === p)) {
        setStatusBoth('anonymous');
        return;
      }
      if (actAsMarker) {
        // this tab was a support (act-as) tab; its memory token is gone after reload → do not fall back to a cookie
        actAsRef.current = true;
        setEndReason('act_as_ended');
        setStatusBoth('ended');
        return;
      }
      void cfg.api.refresh().then((data) => {
        if (data) applySession(data);
        else setStatusBoth('anonymous');
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- cross-tab sign-out ----
    useEffect(() => {
      if (typeof BroadcastChannel === 'undefined') return;
      const ch = new BroadcastChannel(channelName);
      channel.current = ch;
      ch.onmessage = (ev: MessageEvent<string>) => {
        if (ev.data === 'logout' && statusRef.current === 'authenticated' && !actAsRef.current) end('logout');
      };
      return () => ch.close();
    }, [end]);

    // ---- idle sign-out (PRD AUTH-06) ----
    useEffect(() => {
      if (status !== 'authenticated') return;
      let last = Date.now();
      const bump = () => {
        last = Date.now();
      };
      const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'] as const;
      evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
      const idleMinutes = cfg.area === 'admin' ? env.adminIdleMinutes : env.idleMinutes;
      const t = setInterval(() => {
        if (Date.now() - last > idleMinutes * 60_000) {
          void logoutRef.current('idle');
          const span = idleMinutes >= 60 ? `${idleMinutes / 60} hours` : `${idleMinutes} minutes`;
          toast.message(`Signed out after ${span} without activity.`);
        }
      }, 30_000);
      return () => {
        evs.forEach((e) => window.removeEventListener(e, bump));
        clearInterval(t);
      };
    }, [status]);

    useEffect(() => () => clearTimers(), []);

    // ---- actions ----
    const handleLogin = useCallback(
      (res: LoginResponse<P>): LoginStep => {
        if (res.mfaRequired) {
          const m = res as MfaChallenge;
          setMfa({ token: m.mfaToken, purpose: m.mfaPurpose, devCode: m.devCode });
          return m.mfaPurpose;
        }
        applySession(res);
        return 'session';
      },
      [applySession],
    );

    const logout = useCallback(
      async (reason: EndReason = 'logout') => {
        if (!actAsRef.current) {
          await cfg.api.post('/auth/logout', undefined, { skipAuth: true }).catch(() => undefined);
          channel.current?.postMessage('logout');
        }
        end(reason);
      },
      [end],
    );
    const logoutRef = useRef(logout);
    logoutRef.current = logout;

    const value = useMemo<AuthContextValue<P>>(
      () => ({
        area: cfg.area,
        status,
        profile,
        endReason,
        mfa,
        isActingAs: actAsRef.current && status === 'authenticated',
        actAsExpiresAt,
        paths: cfg.paths,
        async login(email, password) {
          return handleLogin(
            await cfg.api.post<LoginResponse<P>>('/auth/login', { email, password }, { skipAuth: true }),
          );
        },
        async verifyMfa(code) {
          if (!mfa) throw new Error('No sign-in in progress');
          const res = await cfg.api.post<unknown>(
            '/auth/2fa/verify',
            { mfaToken: mfa.token, code },
            { skipAuth: true },
          );
          return applySession(res);
        },
        async startEnrol() {
          if (!mfa) throw new Error('No sign-in in progress');
          return cfg.api.post<EnrolSecret>('/auth/2fa/enrol/start', { mfaToken: mfa.token }, { skipAuth: true });
        },
        async confirmEnrol(code) {
          if (!mfa) throw new Error('No sign-in in progress');
          const res = await cfg.api.post<unknown>(
            '/auth/2fa/enrol/confirm',
            { mfaToken: mfa.token, code },
            { skipAuth: true },
          );
          return applySession(res);
        },
        async acceptInvite(token, password) {
          return handleLogin(
            await cfg.api.post<LoginResponse<P>>('/auth/invite/accept', { token, password }, { skipAuth: true }),
          );
        },
        async forgot(email) {
          const r = await cfg.api.post<{ message: string }>('/auth/forgot', { email }, { skipAuth: true });
          return r.message;
        },
        async reset(token, password) {
          const r = await cfg.api.post<{ message: string }>('/auth/reset', { token, password }, { skipAuth: true });
          return r.message;
        },
        logout,
        async logoutAll() {
          await cfg.api.post('/auth/logout-all');
          channel.current?.postMessage('logout');
          end('logout');
        },
        async reloadProfile() {
          try {
            const p = cfg.toProfile(await cfg.api.get<Record<string, unknown>>('/me'));
            setProfileState(p);
            return p;
          } catch (e) {
            toast.error(errorMessage(e));
            return null;
          }
        },
        applySession,
        setProfile: setProfileState,
      }),
      [status, profile, endReason, mfa, actAsExpiresAt, handleLogin, applySession, logout, end],
    );

    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  function useAuth(): AuthContextValue<P> {
    const v = useContext(Ctx);
    if (!v) throw new Error(`use${cfg.area === 'client' ? 'Client' : 'Admin'}Auth must be used inside its provider`);
    return v;
  }

  return { Provider, useAuth };
}
