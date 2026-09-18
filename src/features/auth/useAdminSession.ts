import {useCallback, useEffect, useState} from 'react';
import {httpAdminAuthClient, type AdminAuthClient, type AdminLoginResult} from '../../api/adminAuthClient';
import {loadSession, saveSession, clearSession, type StoredSession} from './session';

export type AdminSessionState =
  | {status: 'loading'}
  | {status: 'authenticated'; session: StoredSession}
  | {status: 'anonymous'};

/**
 * Rehydrates a stored admin session on mount, re-validating it against
 * GET /auth/admin/me (a token can outlive the session on disk, e.g. if the
 * server secret rotated), and exposes login/logout. `client` and `storage`
 * are both injectable: tests use fakes, production uses the real thing.
 */
export function useAdminSession(client: AdminAuthClient = httpAdminAuthClient, storage: Storage = window.localStorage) {
  const [state, setState] = useState<AdminSessionState>({status: 'loading'});

  useEffect(() => {
    const stored = loadSession(storage);
    if (!stored) {
      setState({status: 'anonymous'});
      return;
    }
    client
      .me(stored.token)
      .then((admin) => setState({status: 'authenticated', session: {token: stored.token, admin}}))
      .catch(() => {
        clearSession(storage);
        setState({status: 'anonymous'});
      });
    // storage/client are stable singletons in production; tests pass fresh
    // instances per render on purpose, so this only needs to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    (result: AdminLoginResult) => {
      saveSession(storage, result);
      setState({status: 'authenticated', session: result});
    },
    [storage]
  );

  const logout = useCallback(() => {
    clearSession(storage);
    setState({status: 'anonymous'});
  }, [storage]);

  return {state, login, logout};
}
