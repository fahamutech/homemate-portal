import {describe, test, expect} from 'vitest';
import {loadSession, saveSession, clearSession, type StoredSession} from './session';

function createFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
}

const session: StoredSession = {
  token: 'token-1',
  admin: {email: 'admin@homemate.co.tz', role: 'admin'},
};

describe('session storage helpers', () => {
  test('loadSession returns null when nothing is stored', () => {
    expect(loadSession(createFakeStorage())).toBeNull();
  });

  test('saveSession then loadSession round-trips the session', () => {
    const storage = createFakeStorage();
    saveSession(storage, session);
    expect(loadSession(storage)).toEqual(session);
  });

  test('clearSession removes a previously saved session', () => {
    const storage = createFakeStorage();
    saveSession(storage, session);
    clearSession(storage);
    expect(loadSession(storage)).toBeNull();
  });

  test('loadSession returns null for corrupted JSON instead of throwing', () => {
    const storage = createFakeStorage();
    storage.setItem('homemate.admin-portal.session', '{not-json');
    expect(loadSession(storage)).toBeNull();
  });

  test('loadSession returns null for well-formed JSON missing required fields', () => {
    const storage = createFakeStorage();
    storage.setItem('homemate.admin-portal.session', JSON.stringify({foo: 'bar'}));
    expect(loadSession(storage)).toBeNull();
  });
});
