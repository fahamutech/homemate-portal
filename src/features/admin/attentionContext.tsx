import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import type {AttentionSnapshot} from '../../api/adminApi';
import {useAdminApi} from '../../api/AdminApiContext';

const EMPTY: AttentionSnapshot = {
  counts: {},
  badges: {
    properties: 0,
    agencies: 0,
    users: 0,
    staff: 0,
    payments: 0,
    inquiries: 0,
  },
};

interface AttentionValue extends AttentionSnapshot {
  /** Call after any action that could clear or create work. */
  refresh: () => void;
}

const AttentionContext = createContext<AttentionValue>({...EMPTY, refresh: () => {}});

/**
 * One source of truth for "what needs a human". The server counts it in a
 * single view, so the sidebar badge and the page it points at can never
 * disagree; screens call `refresh()` after they act rather than each keeping
 * their own tally.
 *
 * It re-reads on a timer as well, because work arrives from tenants and
 * payment providers while an operator sits on one screen.
 */
export function AttentionProvider({children, pollMs = 60_000}: {children: ReactNode; pollMs?: number}) {
  const api = useAdminApi();
  const [snapshot, setSnapshot] = useState<AttentionSnapshot>(EMPTY);
  const [token, setToken] = useState(0);
  const mounted = useRef(true);

  const refresh = useCallback(() => setToken((value) => value + 1), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .attention()
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      // A badge is an affordance, not the work itself: if the count cannot be
      // loaded the console stays fully usable with no badges shown.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, token]);

  useEffect(() => {
    if (!pollMs) return undefined;
    const timer = setInterval(refresh, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, refresh]);

  const value = useMemo(() => ({...snapshot, refresh}), [snapshot, refresh]);
  return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>;
}

export function useAttention() {
  return useContext(AttentionContext);
}
