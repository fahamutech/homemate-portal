import {describe, test, expect, vi} from 'vitest';
import {screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PaymentMethodsTab} from './PaymentMethodsTab';
import {renderAdminScreen} from './testUtils';
import {createFakeAdminApi} from '../../api/adminApi.fake';

/**
 * Finds a row by its *Method* cell. A plain text lookup is ambiguous here
 * because a method's name can equal its type ("Cash" / kind `cash`).
 */
function rowFor(name: string) {
  const cell = screen
    .getAllByText(name)
    .find((element) => element.closest('td')?.dataset.label === 'Method');
  return within(cell!.closest('tr')!);
}

describe('PaymentMethodsTab', () => {
  test('lists methods with the provider adapter that settles each one', async () => {
    renderAdminScreen(<PaymentMethodsTab />);

    expect(await screen.findByText('M-Pesa')).toBeInTheDocument();
    expect(rowFor('M-Pesa').getByText('sandbox')).toBeInTheDocument();
    expect(rowFor('Bank transfer').getByText('manual')).toBeInTheDocument();
    expect(screen.getByText(/registered provider adapters: sandbox, manual/i)).toBeInTheDocument();
  });

  test('shows which methods are live', async () => {
    renderAdminScreen(<PaymentMethodsTab />);
    await screen.findByText('M-Pesa');

    expect(rowFor('M-Pesa').getByText('Active')).toBeInTheDocument();
    expect(rowFor('Cash').getByText('Deactivated')).toBeInTheDocument();
  });

  test('enables a disabled method', async () => {
    const api = createFakeAdminApi();
    const updatePaymentMethod = vi.spyOn(api, 'updatePaymentMethod');
    const user = userEvent.setup();
    renderAdminScreen(<PaymentMethodsTab />, {api});
    await screen.findByText('M-Pesa');

    await user.click(rowFor('Cash').getByRole('button', {name: /enable/i}));

    await waitFor(() => expect(updatePaymentMethod).toHaveBeenCalledWith('pm-3', {isActive: true}));
    await waitFor(() => expect(rowFor('Cash').getByText('Active')).toBeInTheDocument());
  });

  test('refuses a provider with no registered adapter, surfacing the server error', async () => {
    const api = createFakeAdminApi();
    const user = userEvent.setup();
    renderAdminScreen(<PaymentMethodsTab />, {api});
    await screen.findByText('M-Pesa');

    await user.click(screen.getByRole('button', {name: /add method/i}));
    const form = within(await screen.findByRole('dialog'));

    // the picker only offers registered adapters…
    const providerSelect = form.getByLabelText(/provider adapter/i);
    expect(within(providerSelect).getByRole('option', {name: 'sandbox'})).toBeInTheDocument();
    expect(within(providerSelect).queryByRole('option', {name: 'stripe'})).not.toBeInTheDocument();

    // …and a duplicate code is refused by the server
    await form.getByLabelText(/^name$/i).focus();
    await user.type(form.getByLabelText(/^name$/i), 'Duplicate M-Pesa');
    await user.type(form.getByLabelText(/^code$/i), 'mpesa');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
  });

  test('creates a new method, disabled until it is explicitly enabled', async () => {
    const api = createFakeAdminApi();
    const createPaymentMethod = vi.spyOn(api, 'createPaymentMethod');
    const user = userEvent.setup();
    renderAdminScreen(<PaymentMethodsTab />, {api});
    await screen.findByText('M-Pesa');

    await user.click(screen.getByRole('button', {name: /add method/i}));
    const form = within(await screen.findByRole('dialog'));
    await user.type(form.getByLabelText(/^name$/i), 'HaloPesa');
    await user.type(form.getByLabelText(/^code$/i), 'halopesa');
    await user.type(form.getByLabelText(/payer instructions/i), 'Pay to 998877.');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    await waitFor(() => {
      expect(createPaymentMethod).toHaveBeenCalledWith(
        expect.objectContaining({code: 'halopesa', name: 'HaloPesa', provider: 'sandbox'})
      );
    });
    expect(await screen.findByText('HaloPesa')).toBeInTheDocument();
    expect(rowFor('HaloPesa').getByText('Deactivated')).toBeInTheDocument();
  });

  test('rejects invalid provider configuration before sending it', async () => {
    const api = createFakeAdminApi();
    const updatePaymentMethod = vi.spyOn(api, 'updatePaymentMethod');
    const user = userEvent.setup();
    renderAdminScreen(<PaymentMethodsTab />, {api});
    await screen.findByText('M-Pesa');

    await user.click(rowFor('M-Pesa').getByRole('button', {name: /configure/i}));
    const form = within(await screen.findByRole('dialog'));
    const config = form.getByLabelText(/provider configuration/i);
    await user.clear(config);
    await user.type(config, '{{not json');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid json/i);
    expect(updatePaymentMethod).not.toHaveBeenCalled();
  });

  test('saves provider configuration as parsed JSON', async () => {
    const api = createFakeAdminApi();
    const updatePaymentMethod = vi.spyOn(api, 'updatePaymentMethod');
    const user = userEvent.setup();
    renderAdminScreen(<PaymentMethodsTab />, {api});
    await screen.findByText('M-Pesa');

    await user.click(rowFor('M-Pesa').getByRole('button', {name: /configure/i}));
    const form = within(await screen.findByRole('dialog'));
    const config = form.getByLabelText(/provider configuration/i);
    await user.clear(config);
    await user.type(config, '{{"shortCode": "123456"}');
    await user.click(form.getByRole('button', {name: /^save$/i}));

    await waitFor(() => {
      expect(updatePaymentMethod).toHaveBeenCalledWith(
        'pm-1',
        expect.objectContaining({config: {shortCode: '123456'}})
      );
    });
  });
});
