import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes; later classes win (e.g. cn('p-4', isTight && 'p-2')). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Initials for avatars: "Rahul Mehta" → "RM". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Only same-site, non-admin relative paths are allowed as ?next= targets (prevents open redirects). */
export function safeNext(next: string | null | undefined, area: 'client' | 'admin'): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  const isAdmin = next === '/admin' || next.startsWith('/admin/');
  if (area === 'client' && isAdmin) return null;
  if (area === 'admin' && !isAdmin) return null;
  return next;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Stable random-ish id for Idempotency-Key headers. */
export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
