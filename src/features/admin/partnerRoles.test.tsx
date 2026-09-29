import {describe, test, expect, vi} from 'vitest';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {UsersPage} from './UsersPage';
import {UserDetailModal} from './UserDetailModal';
import {PropertiesPage} from './PropertiesPage';
import {PropertyFormModal} from './PropertyFormModal';
import {DashboardPage} from './DashboardPage';
import {AdminLayout} from './AdminLayout';
import {AdminSearchProvider} from './searchContext';
import {AttentionProvider} from './attentionContext';
import {AdminApiProvider} from '../../api/AdminApiContext';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';

vi.mock('./LocationPicker', () => ({LocationPicker: () => <div>map</div>}));

/**
 * Partner roles across the rest of the console (T08): role chips on people,
 * suspending a partner role, who listed a home and whether its landlord
 * confirmed, pickers by T01 role, and the partners section in the sidebar.
 */

describe('people carry their roles', () => {
  test('the user list shows each role with its status', async () => {
    renderAdminScreen(<UsersPage staffOnly={false} />);
    const row = within((await screen.findByText('Amina Hassan')).closest('tr')!);
    expect(row.getByText('Landlord · Active')).toBeInTheDocument();
    expect(row.getByText('Customer · Active')).toBeInTheDocument();
  });

  test('a partner role is suspended with a reason and reactivated from the user detail', async () => {
    const api = createFakeAdminApi();
    const change = vi.spyOn(api, 'changeUserRoleStatus');
    const user = userEvent.setup();
    renderAdminScreen(<UserDetailModal userId="user-1" onClose={vi.fn()} onChanged={vi.fn()} />, {api});

    await user.click(await screen.findByRole('button', {name: /^roles$/i}));
    const landlordRow = within(screen.getByTestId('role-landlord'));
    expect(landlordRow.getByText('Active')).toBeInTheDocument();
    expect(within(screen.getByTestId('role-customer')).queryByRole('button')).not.toBeInTheDocument();

    await user.click(landlordRow.getByRole('button', {name: /suspend/i}));
    const confirm = within(await screen.findByRole('dialog', {name: /approve|reject|suspend|reactivate/i}));
    await user.click(confirm.getByRole('button', {name: /suspend/i}));
    expect(change).not.toHaveBeenCalled();
    await user.type(confirm.getByLabelText(/reason/i), 'Listings reported as fake');
    await user.click(confirm.getByRole('button', {name: /suspend/i}));

    await waitFor(() =>
      expect(change).toHaveBeenCalledWith('user-1', 'landlord', {status: 'suspended', reason: 'Listings reported as fake'})
    );
    await user.click(await within(screen.getByTestId('role-landlord')).findByRole('button', {name: /reactivate/i}));
    await user.click(within(await screen.findByRole('dialog', {name: /approve|reject|suspend|reactivate/i})).getByRole('button', {name: /reactivate/i}));
    await waitFor(() => expect(change).toHaveBeenLastCalledWith('user-1', 'landlord', {status: 'active'}));
  });
});

describe('listings show who listed them', () => {
  test('the property list shows the lister and the landlord confirmation', async () => {
    renderAdminScreen(<PropertiesPage />);
    const row = within((await screen.findByText('HM-P-000001')).closest('tr')!);
    expect(row.getByText('Neema Broker')).toBeInTheDocument();
    expect(row.getByText('Broker')).toBeInTheDocument();
    expect(row.getByText('Disputed')).toBeInTheDocument();
  });

  test('the detail explains a dispute', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PropertiesPage />);
    const row = within((await screen.findByText('HM-P-000001')).closest('tr')!);
    await user.click(row.getByRole('button', {name: /view/i}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /people/i}));
    expect(dialog.getByText(/listed by neema broker \(broker\)/i)).toBeInTheDocument();
    expect(dialog.getByText(/disputed: this is not my house/i)).toBeInTheDocument();
  });

  test('the People step picks brokers with an active broker role and landlords in any status but rejected', async () => {
    const api = createFakeAdminApi();
    const listUsers = vi.spyOn(api, 'listUsers');
    renderAdminScreen(<PropertyFormModal onClose={vi.fn()} onSaved={vi.fn()} />, {api});
    await waitFor(() => {
      expect(listUsers).toHaveBeenCalledWith(expect.objectContaining({partnerRole: 'broker', partnerStatus: 'active'}));
      expect(listUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          partnerRole: 'landlord',
          partnerStatus: 'invited,applied,pending_review,action_needed,active,suspended',
        })
      );
    });
    expect(listUsers).not.toHaveBeenCalledWith(expect.objectContaining({role: 'broker'}));
  });
});

describe('the partners section', () => {
  test('the dashboard counts partner applications waiting', async () => {
    renderAdminScreen(<DashboardPage />);
    expect(await screen.findByText(/partner applications waiting/i)).toBeInTheDocument();
    expect(screen.getByTestId('partner-applications-waiting')).toHaveTextContent('2');
  });

  test('a staff account restricted to partners sees only that section (and the dashboard)', () => {
    const staff = {email: 'p@homemate.co.tz', role: 'moderator' as const, allowedRoutes: ['partners']};
    render(
      <MemoryRouter initialEntries={['/admin/partners']}>
        <AdminApiProvider api={createFakeAdminApi()}>
          <AdminSearchProvider>
            <AttentionProvider pollMs={0}>
              <Routes>
                <Route path="/admin" element={<AdminLayout admin={staff} onLogout={vi.fn()} />}>
                  <Route path="partners" element={<div>Partners content</div>} />
                </Route>
              </Routes>
            </AttentionProvider>
          </AdminSearchProvider>
        </AdminApiProvider>
      </MemoryRouter>
    );
    const nav = screen.getByRole('navigation', {name: /admin sections/i});
    expect(within(nav).getAllByRole('link').map((link) => link.textContent?.replace(/\d+$/, '').trim())).toEqual([
      'Dashboard',
      'Partners',
    ]);
  });
});
