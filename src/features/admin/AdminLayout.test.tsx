import {describe, test, expect, vi} from 'vitest';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {AdminLayout} from './AdminLayout';
import {AdminSearchProvider} from './searchContext';
import {AttentionProvider} from './attentionContext';
import {AdminApiProvider} from '../../api/AdminApiContext';
import {createFakeAdminApi} from '../../api/adminApi.fake';
import type {AdminApi, AttentionSnapshot} from '../../api/adminApi';
import styles from './AdminLayout.module.css';

const admin = {email: 'admin@homemate.co.tz', role: 'admin' as const};

function renderAt(path: string, onLogout = vi.fn(), api: AdminApi = createFakeAdminApi()) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AdminApiProvider api={api}>
        <AdminSearchProvider>
          <AttentionProvider pollMs={0}>
            <Routes>
            <Route path="/admin" element={<AdminLayout admin={admin} onLogout={onLogout} />}>
              <Route path="dashboard" element={<div>Dashboard content</div>} />
              <Route path="users" element={<div>Users content</div>} />
            </Route>
            </Routes>
          </AttentionProvider>
        </AdminSearchProvider>
      </AdminApiProvider>
    </MemoryRouter>
  );
}

/// Every badge, defaulting to nothing waiting — a test names only the ones it
/// cares about, so a new badge does not break five unrelated tests.
function badges(overrides: Partial<AttentionSnapshot['badges']> = {}): AttentionSnapshot['badges'] {
  return {
    properties: 0,
    agencies: 0,
    users: 0,
    staff: 0,
    payments: 0,
    inquiries: 0,
    ...overrides,
  };
}

describe('AdminLayout', () => {
  test('renders every nav item and the admin identity', () => {
    renderAt('/admin/dashboard');

    expect(screen.getByRole('link', {name: /dashboard/i})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /users/i})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /settings/i})).toBeInTheDocument();
    expect(screen.getByText('admin@homemate.co.tz')).toBeInTheDocument();
  });

  test('shows the matching top-bar title/subtitle and routed page content for the current path', () => {
    renderAt('/admin/dashboard');

    expect(screen.getByText('Dashboard Overview')).toBeInTheDocument();
    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
  });

  test('marks the current route\'s nav link as active', () => {
    renderAt('/admin/users');

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Users content')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /users/i})).toHaveClass(styles.navItemActive);
    expect(screen.getByRole('link', {name: /dashboard/i})).not.toHaveClass(styles.navItemActive);
  });

  test('logout button calls onLogout', async () => {
    const onLogout = vi.fn();
    const user = userEvent.setup();
    renderAt('/admin/dashboard', onLogout);

    await user.click(screen.getByRole('button', {name: /log out/i}));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  describe('attention badges', () => {
    test('a quiet platform shows no badges at all', async () => {
      const api = createFakeAdminApi({
        attention: async () => ({
          counts: {},
          badges: badges({properties: 0, agencies: 0, users: 0, staff: 0, payments: 0}),
        }),
      });
      renderAt('/admin/dashboard', vi.fn(), api);

      await waitFor(() => {
        expect(screen.queryByLabelText(/need attention/i)).not.toBeInTheDocument();
      });
    });

    test('each module carries the count of what is waiting on it', async () => {
      const api = createFakeAdminApi({
        attention: async () => ({
          counts: {},
          badges: badges({properties: 3, agencies: 1, users: 2, staff: 0, payments: 5}),
        }),
      });
      renderAt('/admin/dashboard', vi.fn(), api);

      const properties = await screen.findByRole('link', {name: /properties/i});
      expect(within(properties).getByLabelText('3 need attention')).toHaveTextContent('3');

      const payments = screen.getByRole('link', {name: /payments/i});
      expect(within(payments).getByLabelText('5 need attention')).toHaveTextContent('5');

      // Staff has nothing waiting, so it carries no badge.
      const staff = screen.getByRole('link', {name: /staff/i});
      expect(within(staff).queryByLabelText(/need attention/i)).not.toBeInTheDocument();
    });

    test('a large count is abbreviated rather than stretching the nav', async () => {
      const api = createFakeAdminApi({
        attention: async () => ({
          counts: {},
          badges: badges({properties: 0, agencies: 0, users: 240, staff: 0, payments: 0}),
        }),
      });
      renderAt('/admin/dashboard', vi.fn(), api);

      const users = await screen.findByRole('link', {name: /users/i});
      // The number still reads in full for a screen reader.
      expect(within(users).getByLabelText('240 need attention')).toHaveTextContent('99+');
    });

    test('the notification bell totals everything waiting', async () => {
      const api = createFakeAdminApi({
        attention: async () => ({
          counts: {},
          badges: badges({properties: 3, agencies: 1, users: 2, staff: 0, payments: 5}),
        }),
      });
      renderAt('/admin/dashboard', vi.fn(), api);

      expect(
        await screen.findByRole('button', {name: /notifications, 11 items need attention/i})
      ).toBeInTheDocument();
    });

    test('a failing count leaves the console fully usable', async () => {
      const api = createFakeAdminApi({
        attention: async () => {
          throw new Error('attention unavailable');
        },
      });
      renderAt('/admin/dashboard', vi.fn(), api);

      // No badges, no error banner — a badge is an affordance, not the work.
      expect(await screen.findByText('Dashboard content')).toBeInTheDocument();
      expect(screen.queryByLabelText(/need attention/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: /^notifications$/i})).toBeInTheDocument();
    });
  });
});
