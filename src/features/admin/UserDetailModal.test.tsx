import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {UsersPage} from './UsersPage';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';

/**
 * Identity: the data HomeMate holds on a person, the evidence behind it, the
 * decisions taken on it, and what the person was asked to put right.
 *
 * Driven through UsersPage rather than the modal alone, because "can an
 * operator actually get to this" is half of what makes the feature exist.
 */

async function openIdentity(user: ReturnType<typeof userEvent.setup>, name = 'Amina Hassan') {
  await user.click(within((await screen.findByText(name)).closest('tr')!).getByRole('button', {name: /view/i}));
  const dialog = within(await screen.findByRole('dialog'));
  await user.click(dialog.getByRole('button', {name: /^identity$/i}));
  return dialog;
}

describe('user identity and KYC', () => {
  test('a user opens on their account, with identity behind a tab', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />);

    await user.click(
      within((await screen.findByText('Amina Hassan')).closest('tr')!).getByRole('button', {name: /view/i})
    );

    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('+255712000001')).toBeInTheDocument();
    expect(dialog.getByRole('button', {name: /^identity$/i})).toBeInTheDocument();
    expect(dialog.getByRole('button', {name: /^documents$/i})).toBeInTheDocument();
    expect(dialog.getByRole('button', {name: /^remediation$/i})).toBeInTheDocument();
  });

  test('identity details are saved, including where money is sent', async () => {
    const api = createFakeAdminApi();
    const updateKycProfile = vi.spyOn(api, 'updateKycProfile');
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});

    const dialog = await openIdentity(user);
    await user.type(dialog.getByLabelText(/national id/i), 'NIDA-12345');
    await user.type(dialog.getByLabelText(/mobile money number/i), '+255754000111');
    await user.click(dialog.getByRole('button', {name: /save identity details/i}));

    await waitFor(() => {
      expect(updateKycProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({nationalIdNumber: 'NIDA-12345', mobileMoneyNumber: '+255754000111'})
      );
    });
    expect(await dialog.findByRole('status')).toHaveTextContent(/saved/i);
  });

  test('it names what is still missing before an identity can be judged', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />);

    const dialog = await openIdentity(user);
    expect(dialog.getByText(/still missing/i)).toHaveTextContent(/national id number/i);
  });

  test('rejecting an identity requires a reason, and records who decided', async () => {
    const api = createFakeAdminApi();
    const reviewKyc = vi.spyOn(api, 'reviewKyc');
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});

    const dialog = await openIdentity(user);
    await user.click(dialog.getByRole('button', {name: /^reject$/i}));
    await user.click(dialog.getByRole('button', {name: /confirm rejection/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/rejection reason is required/i);
    expect(reviewKyc).toHaveBeenCalledTimes(1);

    await user.type(dialog.getByLabelText(/why is this identity rejected/i), 'ID does not match the name');
    await user.click(dialog.getByRole('button', {name: /confirm rejection/i}));

    await waitFor(() => {
      expect(dialog.getByText(/decided by admin@homemate.co.tz/i)).toBeInTheDocument();
    });
  });

  test('verifying an identity clears an earlier rejection', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />);

    const dialog = await openIdentity(user);
    await user.click(dialog.getByRole('button', {name: /^reject$/i}));
    await user.type(dialog.getByLabelText(/why is this identity rejected/i), 'Blurry scan');
    await user.click(dialog.getByRole('button', {name: /confirm rejection/i}));
    await waitFor(() => expect(dialog.getByText(/reason: blurry scan/i)).toBeInTheDocument());

    await user.click(dialog.getByRole('button', {name: /^verify$/i}));

    await waitFor(() => {
      expect(dialog.queryByText(/reason: blurry scan/i)).not.toBeInTheDocument();
    });
  });

  test('a rejected document needs a reason and shows it afterwards', async () => {
    const api = createFakeAdminApi();
    await api.addKycDocument('user-1', {
      documentType: 'national_id',
      file: {base64: 'abc', contentType: 'image/webp', name: 'nida.webp'},
    });
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});

    await user.click(
      within((await screen.findByText('Amina Hassan')).closest('tr')!).getByRole('button', {name: /view/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^documents/i}));

    await user.click(await dialog.findByRole('button', {name: /^reject$/i}));
    await user.click(dialog.getByRole('button', {name: /confirm rejection/i}));
    expect(await screen.findByRole('alert')).toHaveTextContent(/rejection reason is required/i);

    await user.type(dialog.getByLabelText(/why is the national id rejected/i), 'Photo is unreadable');
    await user.click(dialog.getByRole('button', {name: /confirm rejection/i}));

    expect(await dialog.findByText(/reason: photo is unreadable/i)).toBeInTheDocument();
  });

  test('a remediation is raised, shows as open, and closes once', async () => {
    const api = createFakeAdminApi();
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});

    await user.click(
      within((await screen.findByText('Amina Hassan')).closest('tr')!).getByRole('button', {name: /view/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /^remediation/i}));

    await user.type(dialog.getByLabelText(/what is wrong/i), 'ID has expired');
    await user.type(dialog.getByLabelText(/what should they do/i), 'Upload a renewed NIDA card');
    await user.click(dialog.getByRole('button', {name: /raise remediation/i}));

    expect(await dialog.findByText('ID has expired')).toBeInTheDocument();
    expect(dialog.getByText(/^open$/i)).toBeInTheDocument();

    await user.click(dialog.getByRole('button', {name: /mark resolved/i}));

    await waitFor(() => {
      expect(dialog.getByText(/^resolved$/i)).toBeInTheDocument();
    });
    expect(dialog.queryByRole('button', {name: /mark resolved/i})).not.toBeInTheDocument();
  });

  test('the list shows what needs a person, and can filter to only those', async () => {
    const api = createFakeAdminApi();
    const listUsers = vi.spyOn(api, 'listUsers');
    await api.addKycDocument('user-1', {
      documentType: 'national_id',
      file: {base64: 'abc', contentType: 'image/webp'},
    });
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});

    const row = within((await screen.findByText('Amina Hassan')).closest('tr')!);
    expect(await row.findByText(/1 to review/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/attention/i), 'true');
    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({needsAttention: 'true'}));
    });
  });

  test('users are searchable by identity number, not just by name', async () => {
    const api = createFakeAdminApi();
    const listUsers = vi.spyOn(api, 'listUsers');
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});
    await screen.findByText('Amina Hassan');

    await user.type(screen.getByLabelText(/search this page/i), 'NIDA-12345');

    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith(expect.objectContaining({query: 'NIDA-12345'}));
    });
  });

  test('an account can be edited without touching its identity evidence', async () => {
    const api = createFakeAdminApi();
    const updateUser = vi.spyOn(api, 'updateUser');
    const user = userEvent.setup();
    renderAdminScreen(<UsersPage staffOnly={false} />, {api});

    await user.click(
      within((await screen.findByText('Amina Hassan')).closest('tr')!).getByRole('button', {name: /edit/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.clear(dialog.getByLabelText(/full name/i));
    await user.type(dialog.getByLabelText(/full name/i), 'Amina Hassani');
    await user.click(dialog.getByRole('button', {name: /save changes/i}));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith('user-1', expect.objectContaining({fullName: 'Amina Hassani'}));
    });
    expect(await screen.findByText('Amina Hassani')).toBeInTheDocument();
  });
});
