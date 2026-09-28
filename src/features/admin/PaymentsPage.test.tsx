import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PaymentsPage} from './PaymentsPage';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';
import type {AdminApi} from '../../api/adminApi';

/**
 * The money journey through the screen: a collection is recorded, it is split,
 * it is settled only with evidence, and the shares are then disbursed.
 *
 * These drive the fake API, which mirrors the server's branches — including
 * the ones that refuse things — so a screen that looks right against a happy
 * path but mishandles a refusal fails here.
 */

/** Opens the Collections tab, which is no longer the one the page lands on. */
async function openCollections(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', {name: /^collections$/i}));
  await screen.findByRole('button', {name: /record a collection/i});
}

/** Records a collection on the fixture property and returns its reference. */
async function recordCollection(user: ReturnType<typeof userEvent.setup>, amount = '1000000') {
  await user.click(screen.getByRole('button', {name: /record a collection/i}));
  const form = within(await screen.findByRole('dialog'));
  await user.selectOptions(form.getByLabelText(/property/i), 'prop-1');
  await user.type(form.getByLabelText(/^amount$/i), amount);
  await user.click(form.getByRole('button', {name: /record collection/i}));
  return screen.findByText(/HM-PAY-/);
}

function openRow(user: ReturnType<typeof userEvent.setup>, text: RegExp | string) {
  return screen.findByText(text).then(async (cell) => {
    await user.click(within(cell.closest('tr')!).getByRole('button', {name: /view/i}));
    return within(await screen.findByRole('dialog'));
  });
}

describe('PaymentsPage', () => {
  test('the Commissions tab lists each tenant fee with HomeMate’s share and the agent’s', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await user.click(await screen.findByRole('button', {name: /^commissions$/i}));

    const row = within((await screen.findByText('HM-BK-000001')).closest('tr')!);
    expect(row.getByText('TZS 750,000')).toBeInTheDocument();
    expect(row.getByText('TZS 75,000')).toBeInTheDocument();
    expect(row.getByText('10% of the fee')).toBeInTheDocument();
    expect(row.getByText('Asha Broker · Broker')).toBeInTheDocument();
    expect(row.getByText('Verified')).toBeInTheDocument();

    const direct = within(screen.getByText('HM-BK-000002').closest('tr')!);
    expect(direct.getByText('Landlord (listed directly)')).toBeInTheDocument();
    expect(direct.getByText('Pending')).toBeInTheDocument();

    // Totals: fees 1,150,000; HomeMate 115,000 of which 75,000 is verified.
    expect(screen.getByText('TZS 1,150,000')).toBeInTheDocument();
    expect(screen.getByText('TZS 115,000')).toBeInTheDocument();
    expect(screen.getByText('TZS 75,000 verified')).toBeInTheDocument();
  });

  test('the Commissions tab filters to verified placements', async () => {
    const api = createFakeAdminApi();
    const listCommissions = vi.spyOn(api, 'listCommissions');
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});
    await user.click(await screen.findByRole('button', {name: /^commissions$/i}));
    await screen.findByText('HM-BK-000001');

    await user.selectOptions(screen.getByLabelText(/^payment$/i), 'true');

    await waitFor(() => {
      expect(listCommissions).toHaveBeenLastCalledWith(expect.objectContaining({settled: 'true'}));
    });
    await waitFor(() => expect(screen.queryByText('HM-BK-000002')).not.toBeInTheDocument());
  });

  test('opens on the verification queue, because that is what people are waiting on', async () => {
    renderAdminScreen(<PaymentsPage />);

    expect(await screen.findByText(/waiting for payment details/i)).toBeInTheDocument();
    expect(screen.getByText(/customers say they have paid/i)).toBeInTheDocument();
    // The money position is above the tabs, so it is visible either way.
    expect(screen.getByText(/HomeMate commission/i)).toBeInTheDocument();
    expect(screen.getByText(/owed to partners/i)).toBeInTheDocument();
  });

  test('rent recorded by hand is pending and belongs to the landlord whole', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await openCollections(user);

    await recordCollection(user);

    const row = within(screen.getByText(/HM-PAY-/).closest('tr')!);
    expect(row.getByText('Pending')).toBeInTheDocument();

    const detail = await openRow(user, /HM-PAY-/);
    // HomeMate's commission comes only from the tenant fee, never from rent.
    expect(detail.queryByText(/Platform/)).not.toBeInTheDocument();
    expect(detail.getAllByText('TZS 1,000,000').length).toBeGreaterThan(0);
  });

  test('a pending collection offers reconciliation, not a "mark successful" button', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await openCollections(user);
    await recordCollection(user);

    const detail = await openRow(user, /HM-PAY-/);
    expect(detail.getByRole('button', {name: /reconcile as received/i})).toBeInTheDocument();
    expect(detail.queryByRole('button', {name: /mark successful/i})).not.toBeInTheDocument();
  });

  test('reconciling settles the collection and posts the ledger', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await openCollections(user);
    await recordCollection(user);

    const detail = await openRow(user, /HM-PAY-/);
    await user.click(detail.getByRole('button', {name: /reconcile as received/i}));

    expect(await detail.findByText('Successful')).toBeInTheDocument();
    expect(detail.getByText('cash.collections')).toBeInTheDocument();
    expect(detail.queryByText('revenue.commission')).not.toBeInTheDocument();
  });

  test('marking a collection failed requires a reason', async () => {
    const api = createFakeAdminApi();
    const failPayment = vi.spyOn(api, 'failPayment');
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});
    await openCollections(user);
    await recordCollection(user);

    const detail = await openRow(user, /HM-PAY-/);
    await user.click(detail.getByRole('button', {name: /mark failed/i}));
    await user.type(detail.getByLabelText(/why did this collection fail/i), 'Reversed by the bank');
    await user.click(detail.getByRole('button', {name: /^confirm$/i}));

    await waitFor(() => {
      expect(failPayment).toHaveBeenCalledWith(expect.any(String), {reason: 'Reversed by the bank'});
    });
    expect(await detail.findByText('Failed')).toBeInTheDocument();
  });

  test('a collection that has not settled leaves nothing owed', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await openCollections(user);
    await recordCollection(user);

    await user.click(screen.getByRole('button', {name: /disbursements/i}));
    expect(await screen.findByText(/nothing is owed/i)).toBeInTheDocument();
  });

  test('a settled collection puts the landlord in the owed list', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await openCollections(user);
    await recordCollection(user);
    const detail = await openRow(user, /HM-PAY-/);
    await user.click(detail.getByRole('button', {name: /reconcile as received/i}));
    await detail.findByText('Successful');
    await user.click(screen.getByRole('button', {name: /close/i}));

    await user.click(screen.getByRole('button', {name: /disbursements/i}));

    const row = within((await screen.findByText('Amina Hassan')).closest('tr')!);
    expect(row.getByText('TZS 1,000,000')).toBeInTheDocument();
    // HomeMate's own share is not a debt to anyone, so it is not listed here.
    expect(screen.queryByText('HomeMate')).not.toBeInTheDocument();
  });

  test('money owed to an unverified identity is held rather than sent', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await openCollections(user);
    await recordCollection(user);
    let detail = await openRow(user, /HM-PAY-/);
    await user.click(detail.getByRole('button', {name: /reconcile as received/i}));
    await detail.findByText('Successful');
    await user.click(screen.getByRole('button', {name: /close/i}));

    await user.click(screen.getByRole('button', {name: /disbursements/i}));
    const owed = within((await screen.findByText('Amina Hassan')).closest('tr')!);
    await user.click(owed.getByRole('button', {name: /pay out/i}));

    // The fixture landlord has no verified identity, so the payout is held.
    detail = await openRow(user, /HM-PO-/);
    expect(detail.getByText(/on hold/i)).toBeInTheDocument();
    expect(detail.getAllByText(/KYC is not verified/i).length).toBeGreaterThan(0);
  });

  test('a verified beneficiary is paid out, and the money stops being owed', async () => {
    const api = createFakeAdminApi();
    await api.reviewKyc('user-1', {status: 'verified'});
    await api.updateKycProfile('user-1', {mobileMoneyNumber: '+255754000111'});
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});
    await openCollections(user);
    await recordCollection(user);
    let detail = await openRow(user, /HM-PAY-/);
    await user.click(detail.getByRole('button', {name: /reconcile as received/i}));
    await detail.findByText('Successful');
    await user.click(screen.getByRole('button', {name: /close/i}));

    await user.click(screen.getByRole('button', {name: /disbursements/i}));
    const owed = within((await screen.findByText('Amina Hassan')).closest('tr')!);
    await user.click(owed.getByRole('button', {name: /pay out/i}));

    // Claimed money is no longer outstanding, so it cannot be paid twice.
    expect(await screen.findByText(/nothing is owed/i)).toBeInTheDocument();

    detail = await openRow(user, /HM-PO-/);
    expect(detail.getByText('Scheduled')).toBeInTheDocument();
    expect(detail.getByText('+255754000111')).toBeInTheDocument();
  });

  test('a payout cannot skip straight from scheduled to paid', async () => {
    const api = createFakeAdminApi();
    await api.reviewKyc('user-1', {status: 'verified'});
    await api.updateKycProfile('user-1', {mobileMoneyNumber: '+255754000111'});
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});
    await openCollections(user);
    await recordCollection(user);
    let detail = await openRow(user, /HM-PAY-/);
    await user.click(detail.getByRole('button', {name: /reconcile as received/i}));
    await detail.findByText('Successful');
    await user.click(screen.getByRole('button', {name: /close/i}));

    await user.click(screen.getByRole('button', {name: /disbursements/i}));
    await user.click(
      within((await screen.findByText('Amina Hassan')).closest('tr')!).getByRole('button', {name: /pay out/i})
    );

    detail = await openRow(user, /HM-PO-/);
    // "Mark paid" is not even offered while it is only scheduled.
    expect(detail.queryByRole('button', {name: /mark paid/i})).not.toBeInTheDocument();

    await user.click(detail.getByRole('button', {name: /send to provider/i}));
    await detail.findByText('Processing');
    await user.click(detail.getByRole('button', {name: /mark paid/i}));

    expect(await detail.findByText('Paid')).toBeInTheDocument();
    expect(detail.getByText('cash.disbursements')).toBeInTheDocument();
  });

  test('cancelling a payout makes the money payable again', async () => {
    const api = createFakeAdminApi();
    await api.reviewKyc('user-1', {status: 'verified'});
    await api.updateKycProfile('user-1', {mobileMoneyNumber: '+255754000111'});
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});
    await openCollections(user);
    await recordCollection(user);
    let detail = await openRow(user, /HM-PAY-/);
    await user.click(detail.getByRole('button', {name: /reconcile as received/i}));
    await detail.findByText('Successful');
    await user.click(screen.getByRole('button', {name: /close/i}));

    await user.click(screen.getByRole('button', {name: /disbursements/i}));
    await user.click(
      within((await screen.findByText('Amina Hassan')).closest('tr')!).getByRole('button', {name: /pay out/i})
    );
    await screen.findByText(/nothing is owed/i);

    detail = await openRow(user, /HM-PO-/);
    await user.click(detail.getByRole('button', {name: /cancel/i}));
    await detail.findByText(/^cancelled$/i);
    await user.click(detail.getByRole('button', {name: /close/i}));

    // Back in the owed list: the released shares are payable once more.
    const payAgain = await screen.findByRole('button', {name: /pay out/i});
    const owedAgain = within(payAgain.closest('tr')!);
    expect(owedAgain.getByText('Amina Hassan')).toBeInTheDocument();
    expect(owedAgain.getByText('TZS 1,000,000')).toBeInTheDocument();
  });

  test('the ledger is presented as a record, with nothing to edit', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await openCollections(user);
    await recordCollection(user);
    const detail = await openRow(user, /HM-PAY-/);
    await user.click(detail.getByRole('button', {name: /reconcile as received/i}));
    await detail.findByText('Successful');
    await user.click(screen.getByRole('button', {name: /close/i}));

    await user.click(screen.getByRole('button', {name: /ledger/i}));

    expect(await screen.findByText(/append-only/i)).toBeInTheDocument();
    const row = within((await screen.findByText('cash.collections')).closest('tr')!);
    expect(row.queryByRole('button')).not.toBeInTheDocument();
  });

  test('collections are searchable from the top bar', async () => {
    const api: AdminApi = createFakeAdminApi();
    const listPayments = vi.spyOn(api, 'listPayments');
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});
    await openCollections(user);

    await user.type(screen.getByLabelText(/search this page/i), 'Masaki');

    await waitFor(() => {
      expect(listPayments).toHaveBeenLastCalledWith(expect.objectContaining({query: 'Masaki'}));
    });
  });

  test('payment methods are still reachable, on their own tab', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />);
    await openCollections(user);

    await user.click(screen.getByRole('button', {name: /methods/i}));

    expect(await screen.findByText('M-Pesa')).toBeInTheDocument();
  });
});
