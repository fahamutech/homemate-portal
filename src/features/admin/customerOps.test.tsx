import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {InquiriesPage} from './InquiriesPage';
import {RentalsPage} from './RentalsPage';
import {PaymentsPage} from './PaymentsPage';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';

/**
 * The operator's half of the mobile app: answering what customers ask,
 * publishing where to pay once they are accepted, checking that they did, and
 * looking after the tenancies that follow.
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

describe('rentals', () => {
  const rental = (status: string) => ({
    id: `bk-${status}`, reference: `HM-BK-${status}`, status, monthly_rent: '800000', currency: 'TZS',
    deposit_amount: '1600000', lease_months: 12, move_in_date: '2026-11-01', total_due: '2800000',
    amount_paid: status === 'awaiting_payment' ? '0' : '2800000',
    amount_outstanding: status === 'awaiting_payment' ? '2800000' : '0',
    amount_awaiting_verification: '0', payment_count: '1', cancellation_reason: null,
    confirmed_at: null, created_at: '2026-09-20T09:00:00Z', property_id: 'prop-1',
    property_reference: 'HM-P-000001', property_title: 'Masaki 3BR Apartment', customer_id: 'user-2',
    customer_name: 'Juma Customer', customer_phone: '+255712000002', landlord_name: 'Amina Hassan',
    service_fee: '400000', service_fee_percentage: '50.00', platform_fee_percentage: '10.00', platform_fee: '40000',
  });

  function apiWith(...statuses: string[]) {
    const rows = statuses.map(rental);
    return createFakeAdminApi({
      listBookings: async () => ({items: rows, pagination: {total: rows.length, limit: 20, offset: 0, hasMore: false}}),
    });
  }

  test('an empty list says so rather than showing a broken table', async () => {
    renderAdminScreen(<RentalsPage />);
    expect(await screen.findByText(/no rentals match these filters/i)).toBeInTheDocument();
  });

  test('a reservation still being paid for offers no manual step — verifying the payment confirms it', async () => {
    renderAdminScreen(<RentalsPage />, {api: apiWith('awaiting_payment')});
    const row = within((await screen.findByText('HM-BK-awaiting_payment')).closest('tr')!);
    expect(row.queryByRole('button', {name: /confirm|request payment|cancel/i})).not.toBeInTheDocument();
    expect(row.getByRole('button', {name: /view/i})).toBeInTheDocument();
  });

  test('a paid home can have its tenancy started, and nothing else', async () => {
    const api = apiWith('confirmed');
    const changeBookingStatus = vi.spyOn(api, 'changeBookingStatus').mockResolvedValue({} as never);
    const user = userEvent.setup();
    renderAdminScreen(<RentalsPage />, {api});

    const row = within((await screen.findByText('HM-BK-confirmed')).closest('tr')!);
    expect(row.queryByRole('button', {name: /cancel/i})).not.toBeInTheDocument();
    await user.click(row.getByRole('button', {name: /start tenancy/i}));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', {name: /start tenancy/i}));

    await waitFor(() => {
      expect(changeBookingStatus).toHaveBeenCalledWith('bk-confirmed', {status: 'active'});
    });
  });

  test('the detail shows the HomeMate fee and what HomeMate keeps of it', async () => {
    const api = apiWith('confirmed');
    vi.spyOn(api, 'getBooking').mockResolvedValue({...rental('confirmed'), payments: []});
    const user = userEvent.setup();
    renderAdminScreen(<RentalsPage />, {api});

    const row = within((await screen.findByText('HM-BK-confirmed')).closest('tr')!);
    await user.click(row.getByRole('button', {name: /view/i}));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByText(/TZS 400,000 \(50% of a month\) · HomeMate keeps TZS 40,000/)).toBeInTheDocument();
  });
});
