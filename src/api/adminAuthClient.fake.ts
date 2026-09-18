import type {AdminAuthClient, AdminAccount} from './adminAuthClient';
import {AdminAuthApiError} from './adminAuthClient';

const VALID_EMAIL = 'admin@homemate.co.tz';
const VALID_PASSWORD = 'correct-horse-battery-staple';
const VALID_TOKEN = 'fake-admin-session-token';

/**
 * In-memory fake AdminAuthClient for component tests — the frontend
 * equivalent of the backend's sandbox NotificationPort adapter.
 */
export function createFakeAdminAuthClient(overrides: Partial<AdminAuthClient> = {}): AdminAuthClient {
  const admin: AdminAccount = {email: VALID_EMAIL, role: 'admin'};

  return {
    async login(email: string, password: string) {
      if (email.toLowerCase() !== VALID_EMAIL || password !== VALID_PASSWORD) {
        throw new AdminAuthApiError('INVALID_CREDENTIALS', 'Incorrect email or password', 401);
      }
      return {token: VALID_TOKEN, admin};
    },
    async me(token: string) {
      if (token !== VALID_TOKEN) {
        throw new AdminAuthApiError('UNAUTHORIZED', 'Invalid or expired session token', 401);
      }
      return admin;
    },
    ...overrides,
  };
}
