import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {InquiriesPage} from './InquiriesPage';
import {ViewingsPage} from './ViewingsPage';
import {BookingsPage} from './BookingsPage';
import {PaymentsPage} from './PaymentsPage';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';

/**
 * The operator's half of the mobile app: answering what customers ask,
 * confirming when they can visit, and — the part that carries money —
 * publishing where to pay and then checking that they did.
 */

describe('enquiries', () => {
  test('lists what customers asked, with who asked it', async () => {
    renderAdminScreen(<InquiriesPage />);

    expect(await screen.findByText('HM-INQ-000001')).toBeInTheDocument();
    expect(screen.getByText('Juma Customer')).toBeInTheDocument();
    expect(screen.getByText(/Is this still available/)).toBeInTheDocument();
  });

  test('a reply reaches the customer and closes the pending state', async () => {
    const api = createFakeAdminApi();
    const respondToInquiry = vi.spyOn(api, 'respondToInquiry');
    const user = userEvent.setup();
    renderAdminScreen(<InquiriesPage />, {api});

    await user.click(
      within((await screen.findByText('HM-INQ-000001')).closest('tr')!).getByRole('button', {name: /reply/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/your reply/i), 'Yes, available from 1 November.');
    await user.click(dialog.getByRole('button', {name: /send reply/i}));

    await waitFor(() => {
      expect(respondToInquiry).toHaveBeenCalledWith(
        'inq-1',
        expect.objectContaining({status: 'responded', response: 'Yes, available from 1 November.'})
      );
    });
    expect(await screen.findByText('Replied')).toBeInTheDocument();
  });

  test('a reply with nothing written in it is refused', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<InquiriesPage />);

    await user.click(
      within((await screen.findByText('HM-INQ-000001')).closest('tr')!).getByRole('button', {name: /reply/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', {name: /send reply/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/write a reply/i);
  });

  test('declining needs a reason, because the customer is shown it', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<InquiriesPage />);

    await user.click(
      within((await screen.findByText('HM-INQ-000001')).closest('tr')!).getByRole('button', {name: /reply/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.selectOptions(dialog.getByLabelText(/what happens next/i), 'rejected');
    await user.click(dialog.getByRole('button', {name: /decline enquiry/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/why their enquiry was turned down/i);
  });

  test('what the customer told us is shown, so the reply can answer it', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<InquiriesPage />);

    await user.click(
      within((await screen.findByText('HM-INQ-000001')).closest('tr')!).getByRole('button', {name: /reply/i})
    );
    const dialog = within(await screen.findByRole('dialog'));

    expect(dialog.getByText('2026-11-01')).toBeInTheDocument();
    expect(dialog.getByText('TZS 800,000')).toBeInTheDocument();
    expect(dialog.getByText('Whatsapp')).toBeInTheDocument();
  });
});

describe('viewings', () => {
  test('a requested viewing can be confirmed', async () => {
    const api = createFakeAdminApi();
    const changeViewingStatus = vi.spyOn(api, 'changeViewingStatus');
    const user = userEvent.setup();
    renderAdminScreen(<ViewingsPage />, {api});

    const row = within((await screen.findByText('HM-VW-000001')).closest('tr')!);
    await user.click(row.getByRole('button', {name: /confirm/i}));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', {name: /confirm/i}));

    await waitFor(() => {
      expect(changeViewingStatus).toHaveBeenCalledWith('vw-1', expect.objectContaining({status: 'confirmed'}));
    });
    const updated = within((await screen.findByText('HM-VW-000001')).closest('tr')!);
    expect(updated.getByText('Confirmed')).toBeInTheDocument();
  });

  test('cancelling needs a reason the customer will read', async () => {
    const user = userEvent.setup();
    renderAdminScreen(<ViewingsPage />);

    const row = within((await screen.findByText('HM-VW-000001')).closest('tr')!);
    await user.click(row.getByRole('button', {name: /cancel/i}));

    // The dialog asks for a reason before it will let the cancel through.
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByLabelText(/why is it cancelled/i)).toBeInTheDocument();
  });

  test('a completed viewing offers no further moves', async () => {
    const api = createFakeAdminApi();
    await api.changeViewingStatus('vw-1', {status: 'confirmed'});
    await api.changeViewingStatus('vw-1', {status: 'completed'});
    renderAdminScreen(<ViewingsPage />, {api});

    const row = within((await screen.findByText('HM-VW-000001')).closest('tr')!);
    expect(row.queryByRole('button', {name: /confirm|cancel|mark done/i})).not.toBeInTheDocument();
  });
});

describe('the payment queue', () => {
  /** Puts a booking and its unpaid payment in front of the operator. */
  async function bookedButUnpaid(api: ReturnType<typeof createFakeAdminApi>) {
    const booking = await api.recordPayment({propertyId: 'prop-1', amount: 2400000});
    return booking;
  }

  test('a payment with nowhere to pay is listed as blocking the customer', async () => {
    const api = createFakeAdminApi();
    const payment = await api.recordPayment({propertyId: 'prop-1', amount: 2400000});
    // A booking-linked payment is what the queue looks for.
    payment.booking_id = 'bk-1';

    renderAdminScreen(<PaymentsPage />, {api});

    expect(await screen.findByText(/waiting for payment details/i)).toBeInTheDocument();
    expect(await screen.findByText(payment.reference)).toBeInTheDocument();
  });

  test('publishing details requires an account number and a reference', async () => {
    const api = createFakeAdminApi();
    const payment = await bookedButUnpaid(api);
    payment.booking_id = 'bk-1';
    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});

    await user.click(
      within((await screen.findByText(payment.reference)).closest('tr')!)
        .getByRole('button', {name: /publish details/i})
    );
    const dialog = within(await screen.findByRole('dialog'));

    // The browser blocks submitting a required field, so the server rule is
    // exercised by clearing the one the form does not mark required.
    await user.type(dialog.getByLabelText(/lipa namba or account number/i), '5566778');
    await user.type(dialog.getByLabelText(/reference the customer must quote/i), 'HM-BK-000001');
    await user.click(dialog.getByRole('button', {name: /publish to the app/i}));

    await waitFor(async () => {
      const published = await api.getPaymentInstructions(payment.id);
      expect(published.instructions?.account_number).toBe('5566778');
      expect(published.instructions?.payment_reference).toBe('HM-BK-000001');
    });
  });

  test('a declared payment shows the claim beside what was expected', async () => {
    const api = createFakeAdminApi();
    const payment = await bookedButUnpaid(api);
    await api.setPaymentInstructions(payment.id, {
      displayName: 'HomeMate Africa Ltd',
      accountNumber: '5566778',
      paymentReference: 'HM-BK-000001',
    });
    // The customer says they have paid — the app's "I have paid" button.
    payment.customer_declared_paid_at = new Date().toISOString();
    payment.customer_declared_reference = 'QJ12KL9MN';

    renderAdminScreen(<PaymentsPage />, {api});

    expect(await screen.findByText(/customers say they have paid/i)).toBeInTheDocument();
    expect(await screen.findByText('QJ12KL9MN')).toBeInTheDocument();
    // Both numbers side by side, so a mismatch is obvious.
    expect(screen.getAllByText('5566778').length).toBeGreaterThan(0);
  });

  test('verifying settles the payment; the customer’s word alone never did', async () => {
    const api = createFakeAdminApi();
    const reconcilePayment = vi.spyOn(api, 'reconcilePayment');
    const payment = await bookedButUnpaid(api);
    await api.setPaymentInstructions(payment.id, {
      displayName: 'HomeMate Africa Ltd',
      accountNumber: '5566778',
      paymentReference: 'HM-BK-000001',
    });
    payment.customer_declared_paid_at = new Date().toISOString();
    expect(payment.status).toBe('pending');

    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});

    await user.click(
      within((await screen.findByText(payment.reference)).closest('tr')!)
        .getByRole('button', {name: /verify/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/note for the record/i), 'Matched on the statement');
    await user.click(dialog.getByRole('button', {name: /confirm received/i}));

    await waitFor(() => {
      expect(reconcilePayment).toHaveBeenCalledWith(payment.id, {note: 'Matched on the statement'});
    });
    expect((await api.getPayment(payment.id)).status).toBe('successful');
  });

  test('a claim with no matching payment is closed as failed, with the reason', async () => {
    const api = createFakeAdminApi();
    const failPayment = vi.spyOn(api, 'failPayment');
    const payment = await bookedButUnpaid(api);
    await api.setPaymentInstructions(payment.id, {
      displayName: 'HomeMate Africa Ltd',
      accountNumber: '5566778',
      paymentReference: 'HM-BK-000001',
    });
    payment.customer_declared_paid_at = new Date().toISOString();

    const user = userEvent.setup();
    renderAdminScreen(<PaymentsPage />, {api});

    await user.click(
      within((await screen.findByText(payment.reference)).closest('tr')!)
        .getByRole('button', {name: /verify/i})
    );
    const dialog = within(await screen.findByRole('dialog'));
    await user.type(dialog.getByLabelText(/note for the record/i), 'Nothing on the statement');
    await user.click(dialog.getByRole('button', {name: /no payment found/i}));

    await waitFor(() => {
      expect(failPayment).toHaveBeenCalledWith(payment.id, {reason: 'Nothing on the statement'});
    });
  });
});

describe('bookings', () => {
  test('an empty list says so rather than showing a broken table', async () => {
    renderAdminScreen(<BookingsPage />);
    expect(await screen.findByText(/no bookings match these filters/i)).toBeInTheDocument();
  });
});
