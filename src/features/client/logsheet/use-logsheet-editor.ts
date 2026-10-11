'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage, hasCode, isApiError } from '@/lib/api';
import { useHotkey } from '@/lib/hooks';
import {
  apiFieldErrors,
  changedItems,
  computeCalculated,
  initialRaw,
  progress,
  runChecks,
  toItems,
  valuesByCode,
  type RawValues,
} from './form-engine';
import { logApi } from './queries';
import { SUBMITTED_STATUSES, type LogsheetForm } from './types';

/**
 * entry   = filling a new / draft logsheet (autosave + lock)
 * correct = Client Admin changes a submitted logsheet (reason required, LOG-17)
 * request = Editor proposes changes to a submitted logsheet (LOG-19)
 * view    = read only
 */
export type EditorMode = 'entry' | 'correct' | 'request' | 'view';
export type SaveState = 'clean' | 'pending' | 'saving' | 'saved' | 'invalid' | 'error';
export type LockState =
  { kind: 'none' } | { kind: 'mine'; until: string } | { kind: 'other'; byName: string | null; until: string | null };

const AUTOSAVE_MS = 1500;
const RENEW_BEFORE_MS = 4 * 60_000; // re-lock when < 4 of the 15 minutes are left …
const ACTIVE_WINDOW_MS = 10 * 60_000; // … and the user typed in the last 10 minutes

export function useLogsheetEditor({
  plantId,
  form,
  readOnly,
  refetch,
}: {
  plantId: string;
  form: LogsheetForm | undefined;
  /** account state blocks writes (423) */
  readOnly: boolean;
  refetch: () => Promise<{ data?: LogsheetForm }>;
}) {
  const [raw, setRaw] = useState<RawValues>({});
  const [mode, setModeState] = useState<EditorMode>('view');
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [lock, setLock] = useState<LockState>({ kind: 'none' });
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [initKey, setInitKey] = useState<string | null>(null);

  const rawRef = useRef(raw);
  const versionRef = useRef(0);
  const lockRef = useRef<LockState>(lock);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const seq = useRef(0);
  const lastTyped = useRef(0);
  const date = form?.date ?? '';

  const setLockBoth = (l: LockState) => {
    lockRef.current = l;
    setLock(l);
  };

  // ---------------------------------------------------------------- (re)initialise from the server form
  const init = useCallback(
    (f: LogsheetForm, keepTyping = false) => {
      const next = keepTyping ? rawRef.current : initialRaw(f);
      rawRef.current = next;
      setRaw(next);
      versionRef.current = f.logsheet?.version ?? 0;
      setServerErrors({});
      setConflict(false);
      setSaveState(keepTyping ? 'pending' : 'clean');
      setSavedAt(null);
      const other = f.logsheet?.lock;
      setLockBoth(other ? { kind: 'other', byName: other.byName, until: other.until } : { kind: 'none' });
      const submitted = !!f.logsheet && SUBMITTED_STATUSES.includes(f.logsheet.status);
      setModeState(!submitted && f.canEdit && !readOnly && !other ? 'entry' : 'view');
      setInitKey(f.date);
    },
    [readOnly],
  );

  useEffect(() => {
    if (form && initKey !== form.date) init(form);
  }, [form, initKey, init]);

  // ---------------------------------------------------------------- derived values
  const byCode = useMemo(() => (form ? valuesByCode(form, raw) : new Map()), [form, raw]);
  const calc = useMemo(() => (form ? computeCalculated(form, byCode) : {}), [form, byCode]);
  const draftChecks = useMemo(
    () => (form ? runChecks(form, byCode, false) : { errors: {}, warnings: [] }),
    [form, byCode],
  );
  const fullChecks = useMemo(
    () => (form ? runChecks(form, byCode, true) : { errors: {}, warnings: [] }),
    [form, byCode],
  );
  const prog = useMemo(() => (form ? progress(form, byCode) : { blocks: [], filled: 0, total: 0 }), [form, byCode]);
  const changes = useMemo(
    () => (form && (mode === 'correct' || mode === 'request') ? changedItems(form, raw) : []),
    [form, raw, mode],
  );
  const editable = mode !== 'view';

  // ---------------------------------------------------------------- lock (LOG-14)
  const ensureLock = useCallback(async (): Promise<boolean> => {
    const l = lockRef.current;
    if (l.kind === 'other') return false;
    if (l.kind === 'mine' && Date.parse(l.until) - Date.now() > RENEW_BEFORE_MS) return true;
    try {
      const r = await logApi.lock(plantId, date);
      setLockBoth({ kind: 'mine', until: r.lockedUntil });
      return true;
    } catch (e) {
      if (hasCode(e, 'LOGSHEET_LOCKED') && isApiError(e)) {
        const d = e.details as { byName?: string; until?: string } | undefined;
        setLockBoth({ kind: 'other', byName: d?.byName ?? null, until: d?.until ?? null });
        setModeState('view');
        toast.warning(e.message, { description: 'Your changes were not saved. The logsheet is open read-only.' });
      } else {
        toast.error(errorMessage(e));
      }
      return false;
    }
  }, [plantId, date]);

  // renew while the user is active; release when leaving the date
  useEffect(() => {
    if (lock.kind !== 'mine') return;
    const t = setInterval(() => {
      const l = lockRef.current;
      if (l.kind !== 'mine') return;
      const soon = Date.parse(l.until) - Date.now() < RENEW_BEFORE_MS;
      if (soon && Date.now() - lastTyped.current < ACTIVE_WINDOW_MS) void ensureLock();
    }, 60_000);
    return () => clearInterval(t);
  }, [lock.kind, ensureLock]);

  useEffect(() => {
    const d = date;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (lockRef.current.kind === 'mine' && d) {
        lockRef.current = { kind: 'none' };
        void logApi.unlock(plantId, d).catch(() => undefined);
      }
    };
  }, [plantId, date]);

  // ---------------------------------------------------------------- autosave (LOG-13)
  const save = useCallback(async (): Promise<void> => {
    if (!form || mode !== 'entry') return;
    if (inFlight.current) {
      await inFlight.current;
      return save();
    }
    const checks = runChecks(form, valuesByCode(form, rawRef.current), false);
    if (Object.keys(checks.errors).length) {
      setSaveState('invalid');
      return;
    }
    if (!(await ensureLock())) return;
    const started = seq.current;
    setSaveState('saving');
    const p = (async () => {
      try {
        const r = await logApi.saveDraft(plantId, form.date, toItems(form, rawRef.current), versionRef.current);
        versionRef.current = r.version;
        setServerErrors({});
        setSavedAt(new Date().toISOString());
        setSaveState(seq.current === started ? 'saved' : 'pending');
      } catch (e) {
        if (hasCode(e, 'STALE_VERSION', 'LOGSHEET_ALREADY_SUBMITTED')) {
          setConflict(true);
          setSaveState('error');
        } else if (hasCode(e, 'LOGSHEET_LOCKED')) {
          setLockBoth({ kind: 'other', byName: null, until: null });
          setModeState('view');
          setSaveState('error');
          toast.warning(errorMessage(e));
        } else if (hasCode(e, 'VALIDATION_FAILED') && isApiError(e)) {
          setServerErrors(apiFieldErrors(e.details));
          setSaveState('invalid');
        } else {
          setSaveState('error');
          toast.error('Draft not saved', { description: errorMessage(e) });
        }
      }
    })();
    inFlight.current = p;
    await p;
    inFlight.current = null;
  }, [form, mode, plantId, ensureLock]);

  const setValue = useCallback(
    (parameterId: string, value: string) => {
      if (mode === 'view') return;
      const next = { ...rawRef.current, [parameterId]: value };
      rawRef.current = next;
      setRaw(next);
      seq.current++;
      lastTyped.current = Date.now();
      setServerErrors((s) => {
        if (!(parameterId in s)) return s;
        const { [parameterId]: _drop, ...rest } = s;
        return rest;
      });
      if (mode !== 'entry') return;
      setSaveState('pending');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    },
    [mode, save],
  );

  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await save();
  }, [save]);

  useHotkey('mod+s', () => void saveNow(), mode === 'entry');

  // warn before closing the tab with unsaved typing
  useEffect(() => {
    const dirty = mode === 'entry' && ['pending', 'saving', 'invalid', 'error'].includes(saveState);
    const corrDirty = (mode === 'correct' || mode === 'request') && changes.length > 0;
    if (!dirty && !corrDirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [mode, saveState, changes.length]);

  // ---------------------------------------------------------------- submit / corrections
  const submit = useCallback(
    async (remarks?: string) => {
      if (!form) throw new Error('No form');
      if (timer.current) clearTimeout(timer.current);
      if (inFlight.current) await inFlight.current;
      try {
        const r = await logApi.submit(plantId, form.date, toItems(form, rawRef.current), versionRef.current, remarks);
        lockRef.current = { kind: 'none' }; // the API releases the lock on submit
        setLock({ kind: 'none' });
        versionRef.current = r.version;
        setSaveState('clean');
        return r;
      } catch (e) {
        if (hasCode(e, 'VALIDATION_FAILED') && isApiError(e)) setServerErrors(apiFieldErrors(e.details));
        if (hasCode(e, 'STALE_VERSION')) setConflict(true);
        throw e;
      }
    },
    [form, plantId],
  );

  const submitChange = useCallback(
    async (reason: string) => {
      if (!form) throw new Error('No form');
      const items = changedItems(form, rawRef.current);
      try {
        if (mode === 'correct') return await logApi.correct(plantId, form.date, items, versionRef.current, reason);
        return await logApi.requestCorrection(plantId, form.date, items, reason);
      } catch (e) {
        if (hasCode(e, 'VALIDATION_FAILED') && isApiError(e)) setServerErrors(apiFieldErrors(e.details));
        if (hasCode(e, 'STALE_VERSION')) setConflict(true);
        throw e;
      }
    },
    [form, mode, plantId],
  );

  /** Start / stop correcting a submitted logsheet (resets to the stored values). */
  const setMode = useCallback(
    (m: EditorMode) => {
      if (!form) return;
      const base = initialRaw(form);
      rawRef.current = base;
      setRaw(base);
      setServerErrors({});
      setModeState(m);
    },
    [form],
  );

  /** Re-read the form: keepTyping=true keeps the user's values and takes the new version (after a conflict). */
  const reload = useCallback(
    async (keepTyping: boolean) => {
      const r = await refetch();
      if (r.data) init(r.data, keepTyping);
      if (keepTyping) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(), 300);
      }
    },
    [refetch, init, save],
  );

  const errors = { ...draftChecks.errors, ...serverErrors };
  return {
    raw,
    setValue,
    byCode,
    calc,
    /** hard errors shown on the fields while typing (types/ranges) + API errors */
    errors,
    /** what submit would refuse / warn about */
    fullChecks,
    progress: prog,
    changes,
    mode,
    setMode,
    editable,
    saveState,
    savedAt,
    version: versionRef.current,
    lock,
    conflict,
    saveNow,
    submit,
    submitChange,
    reload,
    serverErrors,
  };
}

export type LogsheetEditor = ReturnType<typeof useLogsheetEditor>;
