import {describe, test, expect, vi} from 'vitest';
import {renderHook, waitFor, act} from '@testing-library/react';
import {useAdminSession} from './useAdminSession';
import {createFakeAdminAuthClient} from '../../api/adminAuthClient.fake';
import {saveSession} from './session';
import type {AdminAccount} from '../../api/adminAuthClient';

function createFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() { return store.size; },
  } as Storage;
}

const admin: AdminAccount = {email: 'admin@homemate.co.tz', role: 'admin'};

describe('useAdminSession', () => {
  test('starts anonymous when nothing is stored', async () => {
    const storage = createFakeStorage();
    const {result} = renderHook(() => useAdminSession(createFakeAdminAuthClient(), storage));

    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));
  });

  test('rehydrates an authenticated session that /auth/admin/me confirms is still valid', async () => {
    const storage = createFakeStorage();
    saveSession(storage, {token: 'valid-token', admin});
    const client = createFakeAdminAuthClient({me: vi.fn().mockResolvedValue(admin)});

    const {result} = renderHook(() => useAdminSession(client, storage));

    await waitFor(() => expect(result.current.state.status).toBe('authenticated'));
    expect(client.me).toHaveBeenCalledWith('valid-token');
  });

  test('clears a stored session that /auth/admin/me rejects as invalid/expired', async () => {
    const storage = createFakeStorage();
    saveSession(storage, {token: 'stale-token', admin});
    const client = createFakeAdminAuthClient({me: vi.fn().mockRejectedValue(new Error('401'))});

    const {result} = renderHook(() => useAdminSession(client, storage));

    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));
    expect(storage.getItem('homemate.admin-portal.session')).toBeNull();
  });

  test('login stores the session and moves to authenticated', async () => {
    const storage = createFakeStorage();
    const {result} = renderHook(() => useAdminSession(createFakeAdminAuthClient(), storage));
    await waitFor(() => expect(result.current.state.status).toBe('anonymous'));

    act(() => result.current.login({token: 'new-token', admin}));

    expect(result.current.state).toEqual({status: 'authenticated', session: {token: 'new-token', admin}});
    expect(storage.getItem('homemate.admin-portal.session')).toContain('new-token');
  });

  test('logout clears the session and moves to anonymous', async () => {
    const storage = createFakeStorage();
    saveSession(storage, {token: 'valid-token', admin});
    const client = createFakeAdminAuthClient({me: vi.fn().mockResolvedValue(admin)});
    const {result} = renderHook(() => useAdminSession(client, storage));
    await waitFor(() => expect(result.current.state.status).toBe('authenticated'));

    act(() => result.current.logout());

    expect(result.current.state).toEqual({status: 'anonymous'});
    expect(storage.getItem('homemate.admin-portal.session')).toBeNull();
  });
});
