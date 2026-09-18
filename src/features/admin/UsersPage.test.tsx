import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {UsersPage} from './UsersPage';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';
import {AdminApiError} from '../../api/adminApi';

describe('UsersPage — platform users', () => {
  test('lists users returned by the API', async () => {
    renderAdminScreen(<UsersPage staffOnly={false} />);

    expect(await screen.findByText('Amina Hassan')).toBeInTheDocument();
    expect(screen.getByText('Juma Customer')).toBeInTheDocument();
    // staff must not leak into the platform users list
    expect(screen.queryByText('Amani Moderator')).not.toBeInTheDocument();
  });

  test('shows a loading state, then content', async () => {
    renderAdminScreen(<UsersPage staffOnly={false} />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(await screen.findByText('Amina Hassan')).toBeInTheDocument();
  });

  test('shows an error state with a retry that refetches', async () => {
    const listUsers = vi.fn().mockRejectedValueOnce(new AdminApiError('INTERNAL_ERROR', 'Server exploded', 500));
    const api = createFakeAdminApi({listUsers});
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});

    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded');

    listUsers.mockImplementation(createFakeAdminApi().listUsers);
    await user.click(screen.getByRole('button', {name: /try again/i}));
    expect(await screen.findByText('Amina Hassan')).toBeInTheDocument();
  });

  test('shows an empty state when filters match nothing', async () => {
    const api = createFakeAdminApi();
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});
    await screen.findByText('Amina Hassan');

    await user.type(screen.getByLabelText('Search this page'), 'zzzzz');

    // debounced: the request only goes out once typing settles
    expect(await screen.findByText(/no users match these filters/i, {}, {timeout: 2000})).toBeInTheDocument();
  });

  test('filters by status through the API', async () => {
    const api = createFakeAdminApi();
    const listUsers = vi.spyOn(api, 'listUsers');
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});
    await screen.findByText('Amina Hassan');

    await user.selectOptions(screen.getByLabelText(/status/i), 'suspended');

    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({status: 'suspended', staffOnly: false}));
    });
    expect(await screen.findByText('Juma Customer')).toBeInTheDocument();
    expect(screen.queryByText('Amina Hassan')).not.toBeInTheDocument();
  });

  test('creates a user and refreshes the list', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />);
    await screen.findByText('Amina Hassan');

    await user.click(screen.getByRole('button', {name: /add user/i}));
    const form = within(await screen.findByRole('dialog'));
    await user.type(form.getByLabelText(/full name/i), 'New Landlord');
    await user.type(form.getByLabelText(/phone number/i), '+255712999999');
    await user.selectOptions(form.getByLabelText(/^role$/i), 'landlord');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    expect(await screen.findByText('New Landlord')).toBeInTheDocument();
  });

  test('surfaces a server validation error in the create form', async () => {
    const api = createFakeAdminApi({
      createUser: vi.fn().mockRejectedValue(
        new AdminApiError('CONFLICT', 'That phone number is already registered', 409)
      ),
    });
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});
    await screen.findByText('Amina Hassan');

    await user.click(screen.getByRole('button', {name: /add user/i}));
    const form = within(await screen.findByRole('dialog'));
    await user.type(form.getByLabelText(/full name/i), 'Dup');
    await user.type(form.getByLabelText(/phone number/i), '+255712000001');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already registered/i);
  });

  test('suspension requires a reason before it will submit', async () => {
    const api = createFakeAdminApi();
    const changeUserStatus = vi.spyOn(api, 'changeUserStatus');
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});
    await screen.findByText('Amina Hassan');

    const row = screen.getByText('Amina Hassan').closest('tr')!;
    await user.click(within(row).getByRole('button', {name: /suspend/i}));

    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^suspend$/i}));
    expect(await screen.findByText(/a reason is required/i)).toBeInTheDocument();
    expect(changeUserStatus).not.toHaveBeenCalled();

    await user.type(dialog.getByLabelText(/reason/i), 'Fraudulent listings');
    await user.click(dialog.getByRole('button', {name: /^suspend$/i}));

    await waitFor(() => {
      expect(changeUserStatus).toHaveBeenCalledWith('user-1', {
        status: 'suspended',
        reason: 'Fraudulent listings',
      });
    });
  });

  test('reactivates a suspended user without asking for a reason', async () => {
    const api = createFakeAdminApi();
    const changeUserStatus = vi.spyOn(api, 'changeUserStatus');
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});
    await screen.findByText('Juma Customer');

    const row = screen.getByText('Juma Customer').closest('tr')!;
    await user.click(within(row).getByRole('button', {name: /activate/i}));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^activate$/i}));

    await waitFor(() => {
      expect(changeUserStatus).toHaveBeenCalledWith('user-2', {status: 'active', reason: undefined});
    });
  });

  test('opens a detail view with the suspension reason', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />);
    await screen.findByText('Juma Customer');

    const row = screen.getByText('Juma Customer').closest('tr')!;
    await user.click(within(row).getByRole('button', {name: /view/i}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Payment dispute')).toBeInTheDocument();
  });
});

describe('UsersPage — staff mode', () => {
  test('shows only staff and offers staff roles', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly />);

    expect(await screen.findByText('Amani Moderator')).toBeInTheDocument();
    expect(screen.queryByText('Amina Hassan')).not.toBeInTheDocument();
    expect(screen.getByText('Senior Moderator')).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /invite staff/i}));
    const form = within(await screen.findByRole('dialog'));
    const roleSelect = form.getByLabelText(/^role$/i);
    expect(within(roleSelect).getByRole('option', {name: 'Moderator'})).toBeInTheDocument();
    expect(within(roleSelect).queryByRole('option', {name: 'Customer'})).not.toBeInTheDocument();
    expect(form.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  test('invited staff are created against the staff endpoint', async () => {
    const api = createFakeAdminApi();
    const createUser = vi.spyOn(api, 'createUser');
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly />, {api});
    await screen.findByText('Amani Moderator');

    await user.click(screen.getByRole('button', {name: /invite staff/i}));
    const form = within(await screen.findByRole('dialog'));
    await user.type(form.getByLabelText(/full name/i), 'New Manager');
    await user.selectOptions(form.getByLabelText(/^role$/i), 'manager');
    await user.type(form.getByLabelText(/email address/i), 'manager@homemate.co.tz');
    await user.type(form.getByLabelText(/job title/i), 'Ops Manager');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({fullName: 'New Manager', role: 'manager', email: 'manager@homemate.co.tz'})
      );
    });
  });
});
