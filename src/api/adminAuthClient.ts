export interface AdminAccount {
  email: string;
  role: 'admin';
}

export interface AdminLoginResult {
  token: string;
  admin: AdminAccount;
}

export class AdminAuthApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AdminAuthApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * The portal's boundary against homemate-functions' admin-access module —
 * components depend on this interface, never on `fetch` directly, mirroring
 * the backend's Port/Adapter split (IMPLEMENTATION_PLAN.md Section 2.1).
 * `createFakeAdminAuthClient` is the sandbox-adapter equivalent for tests.
 */
export interface AdminAuthClient {
  login(email: string, password: string): Promise<AdminLoginResult>;
  me(token: string): Promise<AdminAccount>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

async function parseJsonOrThrow(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AdminAuthApiError(body.error ?? 'UNKNOWN_ERROR', body.message ?? response.statusText, response.status);
  }
  return body;
}

export function createHttpAdminAuthClient(baseUrl: string = API_BASE_URL): AdminAuthClient {
  return {
    async login(email: string, password: string) {
      const response = await fetch(`${baseUrl}/auth/admin/login`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email, password}),
      });
      return parseJsonOrThrow(response);
    },

    async me(token: string) {
      const response = await fetch(`${baseUrl}/auth/admin/me`, {
        headers: {authorization: `Bearer ${token}`},
      });
      const body = await parseJsonOrThrow(response);
      return body.admin;
    },
  };
}

export const httpAdminAuthClient = createHttpAdminAuthClient();
