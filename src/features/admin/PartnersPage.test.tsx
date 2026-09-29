import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PartnersPage} from './PartnersPage';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';

/**
 * The partner applications queue (T08): staff verify the people who apply to
 * be brokers or landlords, and approve, ask for something, or reject.
 */

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;

async function openApplication(name: string) {
  const user = userEvent.setup();
  await user.click(within(await rowOf(name)).getByRole('button', {name: /review/i}));
  return {user, dialog: within(await screen.findByRole('dialog'))};
}

describe('partner applications queue', () => {
  test('lists each application with the person, phone, role, submitted date, identity and steps', async () => {
    renderAdminScreen(<PartnersPage />);

    const row = within(await rowOf('Neema Broker'));
    expect(row.getByText('+255713000010')).toBeInTheDocument();
    expect(row.getByText('Broker')).toBeInTheDocument();
    expect(row.getByText('Pending review')).toBeInTheDocument();
    expect(row.getByText('In review')).toBeInTheDocument();
    expect(row.getByText('4 of 4')).toBeInTheDocument();
    expect(row.getByText(new Date('2026-09-21T10:00:00Z').toLocaleDateString())).toBeInTheDocument();
    expect(within(await rowOf('Baraka Mwinyi')).getByText('5 of 5')).toBeInTheDocument();
  });

  test('filters by role, status and search, through the API', async () => {
    const api = createFakeAdminApi();
    const list = vi.spyOn(api, 'listPartnerApplications');
    const user = userEvent.setup();
    renderAdminScreen(<PartnersPage />, {api});
    await rowOf('Neema Broker');

    await user.selectOptions(screen.getByLabelText(/^role$/i), 'landlord');
    await waitFor(() => expect(screen.queryByText('Neema Broker')).not.toBeInTheDocument());
    expect(screen.getByText('Baraka Mwinyi')).toBeInTheDocument();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({role: 'landlord'}));

    await user.selectOptions(screen.getByLabelText(/^role$/i), '');
    await user.selectOptions(screen.getByLabelText(/^status$/i), 'active');
    expect(await screen.findByText('Salma Active')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Neema Broker')).not.toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/^status$/i), '');
    await user.type(screen.getByLabelText(/search this page/i), 'baraka');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({q: 'baraka'})));
    await waitFor(() => expect(screen.queryByText('Neema Broker')).not.toBeInTheDocument());
  });

  test('the drawer shows the person, documents, payout, agreement and ownership proof for a landlord', async () => {
    renderAdminScreen(<PartnersPage />);
    const {dialog} = await openApplication('Baraka Mwinyi');

    expect(dialog.getByText('19900412-12345-00001-23')).toBeInTheDocument();
    expect(dialog.getByText('Mikocheni, Dar es Salaam')).toBeInTheDocument();
    expect(dialog.getByText('Bank account')).toBeInTheDocument();
    expect(dialog.getByText(/v1\.0/)).toBeInTheDocument();
    expect(dialog.getByText('Title deed')).toBeInTheDocument();
    expect(dialog.getByText('National ID')).toBeInTheDocument();
    // a landlord's ownership step and its documents section
    expect(dialog.getAllByText('Ownership proof')).toHaveLength(2);
  });

  test('approving asks for confirmation, then the application is active and the badge refreshes', async () => {
    const api = createFakeAdminApi();
    const decide = vi.spyOn(api, 'decidePartnerApplication');
    const attention = vi.spyOn(api, 'attention');
    renderAdminScreen(<PartnersPage />, {api});
    const {user, dialog} = await openApplication('Neema Broker');

    await user.click(dialog.getByRole('button', {name: /^approve$/i}));
    const confirm = within(await screen.findByRole('dialog', {name: /approve|reject|suspend|reactivate/i}));
    await user.click(confirm.getByRole('button', {name: /approve/i}));

    await waitFor(() => expect(decide).toHaveBeenCalledWith('user-10', 'broker', {decision: 'approve'}));
    await waitFor(() => expect(within(screen.getByText('Neema Broker').closest('tr')!).getByText('Active')).toBeInTheDocument());
    expect(attention).toHaveBeenCalled();
  });

  test('asking for something needs the action to take, and records it', async () => {
    const api = createFakeAdminApi();
    const decide = vi.spyOn(api, 'decidePartnerApplication');
    renderAdminScreen(<PartnersPage />, {api});
    const {user, dialog} = await openApplication('Neema Broker');

    await user.click(dialog.getByRole('button', {name: /ask for something/i}));
    await user.type(dialog.getByLabelText(/what is wrong/i), 'The selfie is blurry');
    await user.click(dialog.getByRole('button', {name: /send request/i}));
    expect(await dialog.findByRole('alert')).toHaveTextContent(/what the applicant should do/i);
    expect(decide).not.toHaveBeenCalled();

    await user.type(dialog.getByLabelText(/what should they do/i), 'Take a new selfie in good light');
    await user.click(dialog.getByRole('button', {name: /send request/i}));

    await waitFor(() =>
      expect(decide).toHaveBeenCalledWith('user-10', 'broker', {
        decision: 'action_needed',
        reason: 'The selfie is blurry',
        remediation: {issue: 'The selfie is blurry', requestedAction: 'Take a new selfie in good light'},
      })
    );
    await waitFor(() =>
      expect(within(screen.getByText('Neema Broker').closest('tr')!).getByText('Action needed')).toBeInTheDocument()
    );
  });

  test('rejecting needs a reason the applicant can read', async () => {
    const api = createFakeAdminApi();
    const decide = vi.spyOn(api, 'decidePartnerApplication');
    renderAdminScreen(<PartnersPage />, {api});
    const {user, dialog} = await openApplication('Neema Broker');

    await user.click(dialog.getByRole('button', {name: /^reject$/i}));
    const confirm = within(await screen.findByRole('dialog', {name: /approve|reject|suspend|reactivate/i}));
    await user.click(confirm.getByRole('button', {name: /reject/i}));
    expect(decide).not.toHaveBeenCalled();

    await user.type(confirm.getByLabelText(/reason/i), 'NIDA does not match the ID');
    await user.click(confirm.getByRole('button', {name: /reject/i}));
    await waitFor(() =>
      expect(decide).toHaveBeenCalledWith('user-10', 'broker', {decision: 'reject', reason: 'NIDA does not match the ID'})
    );
  });

  test('an application that is not waiting for review offers no decision', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PartnersPage />);
    await user.selectOptions(await screen.findByLabelText(/^status$/i), 'active');
    const {dialog} = await openApplication('Salma Active');
    expect(dialog.queryByRole('button', {name: /^approve$/i})).not.toBeInTheDocument();
    expect(dialog.getByText(/already decided/i)).toBeInTheDocument();
  });
});
