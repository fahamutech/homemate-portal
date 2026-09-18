import type {AdminAccount} from '../../api/adminAuthClient';

const STORAGE_KEY = 'homemate.admin-portal.session';

export interface StoredSession {
  token: string;
  admin: AdminAccount;
}

/**
 * Pure, storage-injectable helpers around the one piece of client-side
 * persistence this app has — kept separate from useAdminSession.ts so the
 * (de)serialization logic is unit-testable without touching React or a
 * real `window.localStorage`.
 */
export function loadSession(storage: Pick<Storage, 'getItem'>): StoredSession | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && parsed.admin) {
      return parsed as StoredSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(storage: Pick<Storage, 'setItem'>, session: StoredSession): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(storage: Pick<Storage, 'removeItem'>): void {
  storage.removeItem(STORAGE_KEY);
}
